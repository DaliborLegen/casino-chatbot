import { NextRequest, NextResponse } from "next/server";
import { generateReply } from "@/lib/chat";
import { stripMarkdown } from "@/lib/format";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { isSessionRateLimited } from "@/lib/rate-limit";
import { getTenant, isTenantId, type TenantId } from "@/lib/tenants";

// Tenants with a live bot (system prompt + knowledge base).
const BOT_TENANTS: TenantId[] = ["casino", "supercasino", "casino777"];

export async function POST(req: NextRequest) {
  // Deployment-level default (separate Vercel project per casino), overridable
  // per request for shared deployments.
  const envTenant = process.env.BOT_TENANT;
  let tenant: TenantId = isTenantId(envTenant) ? envTenant : "casino";
  try {
    const { message, sessionId, tenant: bodyTenant } = await req.json();

    if (typeof bodyTenant === "string" && isTenantId(bodyTenant)) {
      tenant = bodyTenant;
    }
    if (!BOT_TENANTS.includes(tenant)) {
      return NextResponse.json({ error: "Bot za to igralnico še ni na voljo." }, { status: 400 });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Sporočilo je predolgo (največ ${MAX_MESSAGE_LENGTH} znakov).` },
        { status: 400 }
      );
    }

    if (sessionId && (await isSessionRateLimited(sessionId))) {
      return NextResponse.json(
        { error: "Preveč sporočil v kratkem času. Prosimo, počakajte minuto." },
        { status: 429 }
      );
    }

    const sid = sessionId || crypto.randomUUID();
    const reply = await generateReply(sid, message.trim(), tenant);

    return NextResponse.json({ reply: stripMarkdown(reply), sessionId: sid });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        error: `Prišlo je do napake. Prosimo, poskusite znova ali nas kontaktirajte na ${getTenant(tenant).supportEmail}.`,
      },
      { status: 500 }
    );
  }
}
