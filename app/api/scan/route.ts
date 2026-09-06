import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runScan(false);
  return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" } });
}

export async function POST() {
  const result = await runScan(true, true);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
