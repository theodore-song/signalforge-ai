import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, clearSession } from "@/lib/auth";
import { isPersistentStorageReady } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 }); }
  const response = NextResponse.json({ ok: true });
  if (isPersistentStorageReady()) await clearSession(request, response);
  return response;
}
