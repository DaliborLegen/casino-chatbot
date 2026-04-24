#!/usr/bin/env node
// One-time setup: create bot agent + register webhook in LiveChat.
// Usage:
//   LIVECHAT_PAT=<base64> LIVECHAT_CLIENT_ID=<oauth-client-id> \
//   LIVECHAT_WEBHOOK_URL=https://chat-bot.bet/api/livechat/webhook \
//   LIVECHAT_WEBHOOK_SECRET=<any-random-string> \
//   node scripts/livechat-setup.mjs

const CONFIG_API = "https://api.livechatinc.com/v3.5/configuration";

const {
  LIVECHAT_PAT,
  LIVECHAT_CLIENT_ID,
  LIVECHAT_WEBHOOK_URL,
  LIVECHAT_WEBHOOK_SECRET,
  BOT_NAME = "Casino.si AI Podpora",
} = process.env;

function requireEnv(name, val) {
  if (!val) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
}

requireEnv("LIVECHAT_PAT", LIVECHAT_PAT);
requireEnv("LIVECHAT_CLIENT_ID", LIVECHAT_CLIENT_ID);
requireEnv("LIVECHAT_WEBHOOK_URL", LIVECHAT_WEBHOOK_URL);
requireEnv("LIVECHAT_WEBHOOK_SECRET", LIVECHAT_WEBHOOK_SECRET);

const headers = {
  "Content-Type": "application/json",
  Authorization: `Basic ${LIVECHAT_PAT}`,
};

async function api(path, body) {
  const res = await fetch(`${CONFIG_API}/action/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function findOrCreateBot() {
  const listRes = await api("list_bots", { owner_client_id: LIVECHAT_CLIENT_ID });
  const bots = Array.isArray(listRes) ? listRes : listRes.bots || [];
  const existing = bots.find((b) => b.name === BOT_NAME);
  if (existing) {
    console.log(`\n[bot] Using existing: ${existing.name} (${existing.id})`);
    return existing.id;
  }
  const created = await api("create_bot", {
    name: BOT_NAME,
    status: "accepting chats",
    owner_client_id: LIVECHAT_CLIENT_ID,
  });
  console.log(`\n[bot] Created: ${BOT_NAME} (${created.id})`);
  return created.id;
}

async function findOrRegisterWebhook() {
  const list = await api("list_webhooks", { owner_client_id: LIVECHAT_CLIENT_ID });
  const hooks = Array.isArray(list) ? list : list.webhooks || [];
  const existing = hooks.find(
    (h) => h.action === "incoming_event" && h.url === LIVECHAT_WEBHOOK_URL
  );
  if (existing) {
    console.log(`[webhook] Using existing: ${existing.id}`);
    return existing.id;
  }
  const created = await api("register_webhook", {
    action: "incoming_event",
    secret_key: LIVECHAT_WEBHOOK_SECRET,
    url: LIVECHAT_WEBHOOK_URL,
    type: "bot",
    owner_client_id: LIVECHAT_CLIENT_ID,
  });
  console.log(`[webhook] Registered: ${created.id}`);
  return created.id;
}

async function main() {
  try {
    const botAgentId = await findOrCreateBot();
    const webhookId = await findOrRegisterWebhook();

    console.log("\n=== Setup complete ===");
    console.log("\nAdd these to Vercel env vars:");
    console.log(`LIVECHAT_BOT_AGENT_ID=${botAgentId}`);
    console.log(`LIVECHAT_PAT=${LIVECHAT_PAT}`);
    console.log(`LIVECHAT_WEBHOOK_SECRET=${LIVECHAT_WEBHOOK_SECRET}`);
    console.log(`\nWebhook ID: ${webhookId}`);
  } catch (err) {
    console.error("Setup failed:", err.message || err);
    process.exit(1);
  }
}

main();
