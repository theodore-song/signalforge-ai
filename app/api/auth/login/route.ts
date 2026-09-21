import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, attachSessionCookie, authenticateUser, authRateLimited, createSession, validateAccountInput } from "@/lib/auth";
import { isPersistentStorageReady } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (!isPersistentStorageReady()) return NextResponse.json({ error: "Account storage is being connected. Please try again shortly." }, { status: 503 });
    const body = await request.json() as { email?: unknown; password?: unknown };
    const input = validateAccountInput("Account", body.email, body.password, false);
    if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
    if (await authRateLimited(request, input.email)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    const user = await authenticateUser(input.email, input.password);
    if (!user) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    const token = await createSession(user.id);
    const response = NextResponse.json({ user });
    attachSessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
