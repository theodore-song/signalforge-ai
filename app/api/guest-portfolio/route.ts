import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/auth";
import {
  attachGuestPortfolioCookie,
  createGuestPortfolioToken,
  guestPortfolioToken,
  readGuestPortfolio,
  writeGuestPortfolio
} from "@/lib/guest-portfolio";
import { migratePaperAccount } from "@/lib/portfolio";
import { isPersistentStorageReady } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isPersistentStorageReady()) {
    return NextResponse.json({ account: null, storageReady: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const existingToken = guestPortfolioToken(request);
  const token = existingToken || createGuestPortfolioToken();
  const account = existingToken ? await readGuestPortfolio(existingToken) : null;
  const response = NextResponse.json({ account, storageReady: true }, { headers: { "Cache-Control": "no-store" } });
  attachGuestPortfolioCookie(response, token);
  return response;
}

export async function PUT(request: NextRequest) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 }); }
  if (!isPersistentStorageReady()) return NextResponse.json({ error: "Persistent storage is not configured" }, { status: 503 });

  const body = await request.json() as { account?: unknown };
  const account = migratePaperAccount(body.account);
  if (!account) return NextResponse.json({ error: "Portfolio data is invalid" }, { status: 400 });

  const token = guestPortfolioToken(request) || createGuestPortfolioToken();
  await writeGuestPortfolio(token, account);
  const response = NextResponse.json({ account, savedAt: new Date().toISOString() });
  attachGuestPortfolioCookie(response, token);
  return response;
}
