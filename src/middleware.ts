import { NextResponse, NextRequest } from "next/server";
import { IP_RATE_LIMIT, IP_RATE_WINDOW_MS } from "@/lib/limits";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function middleware(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS });
    return NextResponse.next();
  }

  if (bucket.count >= IP_RATE_LIMIT) {
    return NextResponse.json(
      { error: "Preveč zahtevkov. Prosimo, počakajte minuto." },
      { status: 429 }
    );
  }

  bucket.count++;
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/chat/:path*", "/api/livechat/webhook/:path*"],
};
