import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/auth";
import { isPersistentStorageReady } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const storageReady = isPersistentStorageReady();
  const user = storageReady ? await sessionUser(request) : null;
  return NextResponse.json({ user, storageReady }, { headers: { "Cache-Control": "no-store" } });
}
