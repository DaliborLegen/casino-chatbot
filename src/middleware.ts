import { NextResponse, NextRequest } from "next/server";
import { IP_RATE_LIMIT, IP_RATE_WINDOW_MS } from "@/lib/limits";

const buckets = new Map<string, { count: number; resetAt: number }>();

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return new NextResponse("Admin not configured (set ADMIN_PASSWORD)", { status: 500 });
    }
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) return unauthorized();
    let provided = "";
    try {
      provided = atob(auth.slice(6)).split(":").slice(1).join(":");
    } catch {
      return unauthorized();
    }
    if (provided !== expected) return unauthorized();
    return NextResponse.next();
  }

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
  matcher: [
    "/api/chat/:path*",
    "/api/livechat/webhook/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
