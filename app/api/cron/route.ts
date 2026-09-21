import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";
import { saveScan } from "@/lib/storage";
import { isPersistentStorageReady } from "@/lib/redis";
import { runEnabledPortfolioAgents } from "@/lib/portfolio-store";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scan = await runScan(true, true);
  const persisted = await saveScan(scan);
  const agents = isPersistentStorageReady() ? await runEnabledPortfolioAgents(scan) : { considered: 0, updated: 0 };
  return NextResponse.json({ ok: true, scanId: scan.id, market: scan.market.label, persisted, agents });
}
