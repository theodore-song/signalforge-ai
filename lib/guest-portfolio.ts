import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { PaperPortfolioAccount } from "./types";
import { readJson, writeJson } from "./redis";

export const GUEST_PORTFOLIO_COOKIE = "signalforge_guest_portfolio";
const GUEST_PORTFOLIO_TTL = 60 * 60 * 24 * 400;

function guestPortfolioKey(token: string) {
  const digest = createHash("sha256").update(token).digest("hex");
  return `sf:guest-portfolio:${digest}`;
}

export function guestPortfolioToken(request: NextRequest) {
  return request.cookies.get(GUEST_PORTFOLIO_COOKIE)?.value || null;
}

export function createGuestPortfolioToken() {
  return randomBytes(32).toString("base64url");
}

export function attachGuestPortfolioCookie(response: NextResponse, token: string) {
  response.cookies.set(GUEST_PORTFOLIO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_PORTFOLIO_TTL,
    priority: "high"
  });
}

export async function readGuestPortfolio(token: string) {
  const account = await readJson<PaperPortfolioAccount>(guestPortfolioKey(token));
  if (account) await writeGuestPortfolio(token, account);
  return account;
}

export async function writeGuestPortfolio(token: string, account: PaperPortfolioAccount) {
  await writeJson(guestPortfolioKey(token), account, GUEST_PORTFOLIO_TTL);
}
