import { NextRequest, NextResponse } from "next/server";
import { portfolioQuotes } from "@/lib/screener";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("symbols") || "";
  const symbols = raw.split(",").map((symbol) => symbol.trim().toUpperCase().replaceAll("/", ".")).filter(Boolean);
  if (!symbols.length || symbols.length > 50) return NextResponse.json({ error: "Choose between one and 50 symbols" }, { status: 400 });
  if (new Set(symbols).size !== symbols.length) return NextResponse.json({ error: "Quote symbols must be unique" }, { status: 400 });
  if (symbols.some((symbol) => !/^[A-Z0-9.-]{1,8}$/.test(symbol))) return NextResponse.json({ error: "One or more symbols are malformed" }, { status: 400 });
  return NextResponse.json(await portfolioQuotes(symbols), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" } });
}
