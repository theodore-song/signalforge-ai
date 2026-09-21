import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, sessionUser } from "@/lib/auth";
import { getPortfolio, runPortfolioAgent, updateAgent } from "@/lib/portfolio-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function authorize(request: NextRequest, id: string) {
  const user = await sessionUser(request);
  if (!user) return null;
  const portfolio = await getPortfolio(id);
  return portfolio?.userId === user.id ? user : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 }); }
  const { id } = await context.params;
  const user = await authorize(request, id);
  if (!user) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  const body = await request.json() as { enabled?: unknown; targetPositions?: unknown; cashReservePct?: unknown };
  const portfolio = await updateAgent(user.id, id, {
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    targetPositions: typeof body.targetPositions === "number" ? body.targetPositions : undefined,
    cashReservePct: typeof body.cashReservePct === "number" ? body.cashReservePct : undefined
  });
  return NextResponse.json({ portfolio });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 }); }
  const { id } = await context.params;
  const user = await authorize(request, id);
  if (!user) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  const portfolio = await runPortfolioAgent(id, undefined, true);
  return NextResponse.json({ portfolio });
}
