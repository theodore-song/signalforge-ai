import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, sessionUser } from "@/lib/auth";
import { migratePaperAccount } from "@/lib/portfolio";
import { getPortfolio, savePortfolio } from "@/lib/portfolio-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const portfolio = await getPortfolio(id);
  if (!portfolio || portfolio.userId !== user.id) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  return NextResponse.json({ portfolio }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 }); }
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as { account?: unknown; name?: unknown };
  const account = migratePaperAccount(body.account);
  if (!account) return NextResponse.json({ error: "Portfolio data is invalid" }, { status: 400 });
  const portfolio = await savePortfolio(user.id, id, account, typeof body.name === "string" ? body.name : undefined);
  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  return NextResponse.json({ portfolio });
}
