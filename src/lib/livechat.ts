const CONFIG_API = "https://api.livechatinc.com/v3.5/configuration";
const AGENT_API = "https://api.livechatinc.com/v3.5/agent";

function getAuthHeader(): string {
  const token = process.env.LIVECHAT_PAT;
  if (!token) throw new Error("LIVECHAT_PAT not set");
  return `Basic ${token}`;
}

async function livechatFetch(url: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LiveChat API ${url} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function createBot(name: string): Promise<{ id: string }> {
  return livechatFetch(`${CONFIG_API}/action/create_bot`, {
    name,
    status: "accepting chats",
  });
}

export async function listBots(): Promise<{ bots: Array<{ id: string; name: string }> }> {
  return livechatFetch(`${CONFIG_API}/action/list_bots`, {});
}

export async function registerWebhook(params: {
  action: string;
  secret_key: string;
  url: string;
  type: "bot";
  owner_client_id: string;
}): Promise<{ id: string }> {
  return livechatFetch(`${CONFIG_API}/action/register_webhook`, params);
}

export async function listWebhooks(owner_client_id: string) {
  return livechatFetch(`${CONFIG_API}/action/list_webhooks`, { owner_client_id });
}

export function formatForLiveChat(text: string): string {
  // LiveChat widget renders messages as plain text — markdown markers (**bold**, *italic*,
  // `code`) leak through visibly. Strip the markers so output is clean.
  // Slovenian uses č/š/ž which are not in Unicode mathematical-bold block, so unicode-bold
  // conversion produces inconsistent text — strip is the safe option.
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^\*])\*(?!\s)([^\*\n]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

export async function sendTextMessage(params: {
  chat_id: string;
  text: string;
  bot_agent_id: string;
}): Promise<unknown> {
  return livechatFetch(
    `${AGENT_API}/action/send_event`,
    {
      chat_id: params.chat_id,
      event: {
        type: "message",
        text: formatForLiveChat(params.text),
        recipients: "all",
      },
    },
    { "X-Author-Id": params.bot_agent_id }
  );
}

export async function setRoutingStatus(params: {
  agent_id: string;
  status: "accepting chats" | "not accepting chats";
}) {
  return livechatFetch(`${AGENT_API}/action/set_routing_status`, params, {
    "X-Author-Id": params.agent_id,
  });
}
