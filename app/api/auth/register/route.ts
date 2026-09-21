import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, attachSessionCookie, authRateLimited, createSession, createUser, validateAccountInput } from "@/lib/auth";
import { migratePaperAccount } from "@/lib/portfolio";
import { createPortfolio } from "@/lib/portfolio-store";
import { isPersistentStorageReady } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (!isPersistentStorageReady()) return NextResponse.json({ error: "Account storage is being connected. Please try again shortly." }, { status: 503 });
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown; importedAccount?: unknown };
    const input = validateAccountInput(body.name, body.email, body.password);
    if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
    if (await authRateLimited(request, input.email)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    const user = await createUser(input.name, input.email, input.password);
    const imported = migratePaperAccount(body.importedAccount);
    const portfolio = await createPortfolio(user.id, imported ? "Imported Portfolio" : "Main Portfolio", imported?.startingBalance || 100_000, imported || undefined);
    const token = await createSession(user.id);
    const response = NextResponse.json({ user, portfolio }, { status: 201 });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account creation failed.";
    return NextResponse.json({ error: message }, { status: message.includes("already exists") ? 409 : 500 });
  }
}
