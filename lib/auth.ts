import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "./types";
import { readJson, redisCommand, writeJson } from "./redis";

const scrypt = promisify(nodeScrypt);
export const SESSION_COOKIE = "signalforge_session";
const SESSION_TTL = 60 * 60 * 24 * 30;

type StoredUser = AuthUser & { passwordHash: string; createdAt: string };
type StoredSession = { userId: string; expiresAt: string };

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailKey(email: string) {
  return `sf:user-email:${digest(email.trim().toLowerCase())}`;
}

function userKey(id: string) {
  return `sf:user:${id}`;
}

function sessionKey(token: string) {
  return `sf:session:${digest(token)}`;
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

export function validateAccountInput(name: unknown, email: unknown, password: unknown, requireName = true) {
  const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 50) : "";
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = typeof password === "string" ? password : "";
  if (requireName && (cleanName.length < 2 || cleanName.length > 50)) return { error: "Enter a name between 2 and 50 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { error: "Enter a valid email address." };
  if (cleanPassword.length < 10 || !/[A-Za-z]/.test(cleanPassword) || !/\d/.test(cleanPassword)) return { error: "Use at least 10 characters with a letter and a number." };
  return { name: cleanName, email: cleanEmail, password: cleanPassword };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, encoded] = stored.split(":");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createUser(name: string, email: string, password: string) {
  const id = randomUUID();
  const reserved = await redisCommand<string | null>("SET", emailKey(email), id, "NX");
  if (!reserved) throw new Error("An account already exists for this email address.");
  try {
    const user: StoredUser = { id, name, email, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
    await writeJson(userKey(id), user);
    return publicUser(user);
  } catch (error) {
    await redisCommand("DEL", emailKey(email));
    throw error;
  }
}

export async function authenticateUser(email: string, password: string) {
  const id = await redisCommand<string | null>("GET", emailKey(email));
  const user = id ? await readJson<StoredUser>(userKey(id)) : null;
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return publicUser(user);
}

function publicUser(user: StoredUser): AuthUser {
  return { id: user.id, name: user.name, email: user.email };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000).toISOString();
  await writeJson(sessionKey(token), { userId, expiresAt } satisfies StoredSession, SESSION_TTL);
  return token;
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
    priority: "high"
  });
}

export async function clearSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await redisCommand("DEL", sessionKey(token));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function sessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readJson<StoredSession>(sessionKey(token));
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const user = await readJson<StoredUser>(userKey(session.userId));
  return user ? publicUser(user) : null;
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (new URL(origin).host !== request.nextUrl.host) throw new Error("Request origin is not allowed");
}

export async function authRateLimited(request: NextRequest, email: string) {
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const key = `sf:auth-rate:${digest(`${ip}:${email}`)}`;
  const count = await redisCommand<number>("INCR", key);
  if (count === 1) await redisCommand("EXPIRE", key, 900);
  return count > 12;
}
