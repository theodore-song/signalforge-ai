import { NextRequest, NextResponse } from "next/server";
import { availableSectors, queryScreener } from "@/lib/screener";
import { SEARCH_FACTORS, type SearchFactorKey } from "@/lib/types";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number) {
  if (value == null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const factor = (params.get("factor") || "quality") as SearchFactorKey;
  if (!SEARCH_FACTORS.includes(factor)) return NextResponse.json({ error: "Unsupported factor" }, { status: 400 });
  const page = positiveInteger(params.get("page"), 1);
  const limit = positiveInteger(params.get("limit"), 50);
  if (!page || !limit || limit > 100) return NextResponse.json({ error: "page and limit must be positive integers; limit cannot exceed 100" }, { status: 400 });
  const query = (params.get("q") || "").trim();
  if (query.length > 64) return NextResponse.json({ error: "Search query cannot exceed 64 characters" }, { status: 400 });
  const sector = params.get("sector") || "All sectors";
  if (sector !== "All sectors" && !availableSectors().includes(sector)) return NextResponse.json({ error: "Unsupported sector" }, { status: 400 });
  const result = await queryScreener({ factor, query, sector, page, limit });
  return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" } });
}
