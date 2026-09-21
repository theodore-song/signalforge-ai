import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, sessionUser } from "@/lib/auth";
import { migratePaperAccount } from "@/lib/portfolio";
import { createPortfolio, listPortfolios } from "@/lib/portfolio-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json({ portfolios: await listPortfolios(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 }); }
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { name?: unknown; startingBalance?: unknown; importedAccount?: unknown };
  const startingBalance = Number(body.startingBalance);
  if (!Number.isFinite(startingBalance) || startingBalance < 1_000 || startingBalance > 100_000_000) return NextResponse.json({ error: "Starting balance must be between $1,000 and $100,000,000." }, { status: 400 });
  const imported = body.importedAccount ? migratePaperAccount(body.importedAccount, startingBalance) : null;
  if (body.importedAccount && !imported) return NextResponse.json({ error: "The imported portfolio is invalid." }, { status: 400 });
  const portfolio = await createPortfolio(user.id, typeof body.name === "string" ? body.name : "New Portfolio", startingBalance, imported || undefined);
  return NextResponse.json({ portfolio }, { status: 201 });
}
