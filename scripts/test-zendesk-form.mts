// Test za pre-chat obrazec v Zendesk webhooku (src/app/api/zendesk/webhook/route.ts).
// Zendeskov API je nadomescen z lazno implementacijo global.fetch, zato test ne
// zahteva ne Zendeska ne Supabase.
// Zagon: npx tsx scripts/test-zendesk-form.mts
import type { NextRequest } from "next/server";

const BOT_SWITCHBOARD = "sb_bot";
const INTEGRATION_777 = "int_777";

process.env.ZENDESK_SUBDOMAIN = "casinosi";
process.env.ZENDESK_APP_ID = "app_test";
process.env.ZENDESK_KEY_ID = "key_test";
process.env.ZENDESK_SECRET = "secret_test";
process.env.ZENDESK_BOT_SWITCHBOARD_ID = BOT_SWITCHBOARD;
process.env.ZENDESK_ONLY_INTEGRATIONS = INTEGRATION_777;
process.env.ZENDESK_TENANT_BY_INTEGRATION = `${INTEGRATION_777}:casino777`;
process.env.ZENDESK_TENANT = "casino777";
process.env.ZENDESK_TENANT_BY_BRAND = "brand_777:casino777";
delete process.env.ZENDESK_WEBHOOK_SECRET; // preskoci preverjanje podpisa
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.ANTHROPIC_API_KEY = "sk-test";

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

let calls: Call[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const path = url.replace(/^https:\/\/[^/]+\/sc\/v2\/apps\/[^/]+/, "");
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  calls.push({ method, path, body });

  if (method === "GET" && /^\/conversations\/[^/]+$/.test(path)) {
    // Nas bot ima nadzor nad pogovorom.
    return new Response(
      JSON.stringify({ conversation: { activeSwitchboardIntegration: { id: BOT_SWITCHBOARD } } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (path.startsWith("/v1/messages") || url.includes("api.anthropic.com")) {
    return new Response(
      JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "Odgovor bota." }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const { POST } = await import("../src/app/api/zendesk/webhook/route.ts");

let eventSeq = 0;

function post(
  conversationId: string,
  content: Record<string, unknown>,
  opts: { userId?: string } = {}
) {
  const body = JSON.stringify({
    events: [
      {
        id: `evt_${++eventSeq}`,
        type: "conversation:message",
        payload: {
          conversation: { id: conversationId },
          message: {
            id: `msg_${eventSeq}`,
            author: { type: "user", userId: opts.userId ?? "user_1" },
            content,
            source: { type: "web", integrationId: INTEGRATION_777 },
          },
        },
      },
    ],
  });
  const req = new Request("https://chat-bot.bet/api/zendesk/webhook", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
  return POST(req as unknown as NextRequest);
}

function postCreate(
  conversationId: string,
  opts: { reason?: string; brandId?: string } = {}
) {
  const body = JSON.stringify({
    events: [
      {
        id: `evt_${++eventSeq}`,
        type: "conversation:create",
        payload: {
          creationReason: opts.reason ?? "startConversation",
          conversation: { id: conversationId, brandId: opts.brandId ?? "brand_777" },
        },
      },
    ],
  });
  const req = new Request("https://chat-bot.bet/api/zendesk/webhook", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
  return POST(req as unknown as NextRequest);
}

function open() {
  process.env.SUPPORT_HOURS_START = "0";
  process.env.SUPPORT_HOURS_END = "24";
}

function closed() {
  process.env.SUPPORT_HOURS_START = "0";
  process.env.SUPPORT_HOURS_END = "0";
}

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name}${
      ok
        ? ""
        : `\n     dobil:      ${JSON.stringify(actual)}\n     pricakoval: ${JSON.stringify(expected)}`
    }`
  );
}

const posted = () => calls.filter((c) => c.method === "POST" && c.path.endsWith("/messages"));
const handoffs = () => calls.filter((c) => c.path.endsWith("/passControl"));
const forms = () =>
  posted().filter((c) => (c.body.content as { type?: string } | undefined)?.type === "form");

// 1. Prvo sporocilo gosta v delovnem casu: obrazec, brez predaje agentom.
open();
calls = [];
await post("conv_day", { type: "text", text: "Pozdravljeni, kako dvignem dobitek?" });
check("1a. obrazec poslan", forms().length, 1);
check("1b. uvodno besedilo pred obrazcem", posted().length, 2);
check("1c. brez predaje agentom", handoffs().length, 0);
check(
  "1d. polja obrazca",
  ((forms()[0].body.content as { fields: { name: string }[] }).fields ?? []).map((f) => f.name),
  ["name", "email"]
);

// 2. Gost izpolni obrazec: profil + predaja agentom s kontaktom.
calls = [];
await post("conv_day", {
  type: "formResponse",
  fields: [
    { type: "text", name: "name", label: "Ime in priimek", text: "Ana Novak" },
    { type: "email", name: "email", label: "E-postni naslov", email: "ana@example.com" },
  ],
});
const profile = calls.find((c) => c.method === "PATCH" && c.path.startsWith("/users/"));
check("2a. profil gosta posodobljen", Boolean(profile), true);
check("2b. ime v profilu", (profile?.body.profile as Record<string, string>)?.givenName, "Ana");
check("2c. email v profilu", (profile?.body.profile as Record<string, string>)?.email, "ana@example.com");
check("2d. predaja agentom", handoffs().length, 1);
const meta = handoffs()[0].body.metadata as Record<string, string>;
check("2e. ime v predaji", meta["dataCapture.systemField.requester.name"], "Ana Novak");
check("2f. email v predaji", meta["dataCapture.systemField.requester.email"], "ana@example.com");
check("2g. cilj predaje", handoffs()[0].body.switchboardIntegration, "next");
check("2h. brez novega obrazca", forms().length, 0);

// 3. Naslednje sporocilo v istem pogovoru: brez ponovnega obrazca.
calls = [];
await post("conv_day", { type: "text", text: "Se eno vprasanje" });
check("3a. brez obrazca", forms().length, 0);
check("3b. takojsnja predaja", handoffs().length, 1);

// 4. Gost obrazec ignorira in pise naprej: obrazec dobi znova, brez predaje.
calls = [];
await post("conv_skip", { type: "text", text: "Prvo sporocilo" });
check("4a. obrazec ob prvem sporocilu", forms().length, 1);
check(
  "4b. obrazec zaklene vnos",
  (forms()[0].body.content as { blockChatInput?: boolean }).blockChatInput,
  true
);
calls = [];
await post("conv_skip", { type: "text", text: "Nocem izpolniti obrazca" });
check("4c. obrazec znova", forms().length, 1);
check("4d. brez predaje agentom", handoffs().length, 0);
calls = [];
await post("conv_skip", { type: "text", text: "Se vedno nocem" });
check("4e. tretji poskus", forms().length, 1);
check("4f. se vedno brez predaje", handoffs().length, 0);
calls = [];
await post("conv_skip", { type: "text", text: "Pa dajte ze" });
check("4g. po treh poskusih ne sprasujemo vec", forms().length, 0);
check("4h. gost gre agentom tudi brez podatkov", handoffs().length, 1);

// 5. Ponoci: obrazec, nato bot odgovori na vprasanje izpred obrazca.
closed();
calls = [];
await post("conv_night", { type: "text", text: "Kaksni so pogoji za bonus?" });
check("5a. obrazec tudi ponoci", forms().length, 1);
check("5b. brez predaje agentom", handoffs().length, 0);
calls = [];
await post("conv_night", {
  type: "formResponse",
  fields: [
    { type: "text", name: "name", label: "Ime in priimek", text: "Bojan" },
    { type: "email", name: "email", label: "E-postni naslov", email: "bojan@example.com" },
  ],
});
check("5c. ponoci brez predaje agentom", handoffs().length, 0);
const nightReplies = posted().filter(
  (c) => (c.body.content as { type?: string } | undefined)?.type === "text"
);
check("5d. bot odgovoril", nightReplies.length, 1);
check(
  "5e. odgovor je botov, ne le pozdrav",
  (nightReplies[0].body.content as { text: string }).text,
  "Odgovor bota."
);

// 6. Gost samo odpre klepet: obrazec pride se pred prvim sporocilom.
open();
calls = [];
await postCreate("conv_open");
check("6a. obrazec ob odprtju", forms().length, 1);
check("6b. brez predaje agentom", handoffs().length, 0);
calls = [];
await post("conv_open", { type: "text", text: "Pozdravljeni" });
check("6c. brez podatkov ni predaje agentom", handoffs().length, 0);
check("6d. namesto tega opomnik z obrazcem", forms().length, 1);

// 7. Pogovor, ki nastane sele s sporocilom: ob odprtju ne pozdravimo.
calls = [];
await postCreate("conv_reason", { reason: "message" });
check("7. brez obrazca ob reason=message", forms().length, 0);

// 8. Tuja znamka: ne pozdravljamo.
calls = [];
await postCreate("conv_brand", { brandId: "brand_casino" });
check("8. brez obrazca za tujo znamko", forms().length, 0);

console.log(failures === 0 ? "\nVse preverbe OK" : `\n${failures} preverb ni uspelo`);
process.exit(failures === 0 ? 0 : 1);
