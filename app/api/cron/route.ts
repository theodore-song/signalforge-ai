import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";
import { saveScan } from "@/lib/storage";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scan = await runScan(true);
  const persisted = await saveScan(scan);
  return NextResponse.json({ ok: true, scanId: scan.id, market: scan.market.label, persisted });
}
