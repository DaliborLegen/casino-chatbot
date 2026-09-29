import { NextRequest, NextResponse } from "next/server";
import { ensureConversation, fallbackReply, generateReply, recordAgentHandoff } from "@/lib/chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { isSessionRateLimited } from "@/lib/rate-limit";
import { isSupportOpen } from "@/lib/support-hours";
import { isTenantId, type TenantId } from "@/lib/tenants";
import {
  describeSignatureHeaders,
  getActiveSwitchboardId,
  getConversationBrandId,
  getZendeskConfig,
  passControlToAgent,
  passControlToIntegration,
  postBusinessMessage,
  sendContactForm,
  updateUserProfile,
  verifyWebhookSignature,
  type ZendeskConfig,
} from "@/lib/zendesk";
import { hasContactDetails, loadContact, saveContact } from "@/lib/zendesk-contact";

export const runtime = "nodejs";
export const maxDuration = 30;

const ATTACHMENT_REPLY = "Priponke žal ne morem prebrati, prosim opišite svojo težavo.";

/**
 * Event ids already handled. Zendesk re-delivers events when a webhook is slow
 * or errors, and the same message must not be answered twice.
 *
 * In-memory, so it only dedupes within one serverless instance — enough for the
 * common retry burst. A cross-instance guard would need a Supabase table; add it
 * if duplicates show up in production.
 */
const seenEvents = new Map<string, number>();
const SEEN_TTL_MS = 10 * 60 * 1000;

function alreadyHandled(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of seenEvents) {
    if (now - ts > SEEN_TTL_MS) seenEvents.delete(id);
  }
  if (seenEvents.has(eventId)) return true;
  seenEvents.set(eventId, now);
  return false;
}

/**
 * Serialises processing per conversation so two quick messages can't race each
 * other into a double reply or a double handoff.
 */
const conversationLocks = new Map<string, Promise<void>>();

function withConversationLock(conversationId: string, task: () => Promise<void>): Promise<void> {
  const previous = conversationLocks.get(conversationId) ?? Promise.resolve();
  const next = previous.then(task, task).finally(() => {
    if (conversationLocks.get(conversationId) === next) conversationLocks.delete(conversationId);
  });
  conversationLocks.set(conversationId, next);
  return next;
}

/**
 * A `formResponse` carries the guest's answers, one entry per field, with the
 * value under a key named after the field type (`text`, `email`).
 */
interface ZendeskFormField {
  name?: string;
  type?: string;
  label?: string;
  text?: string;
  email?: string;
}

interface ZendeskContent {
  type?: string;
  text?: string;
  fields?: ZendeskFormField[];
}

interface ZendeskEvent {
  id?: string;
  type?: string;
  payload?: {
    /** Why the conversation was created; "startConversation" = widget opened. */
    creationReason?: string;
    conversation?: {
      id?: string;
      _id?: string;
      /** Which casino brand the conversation belongs to. */
      brandId?: string;
      creationReason?: string;
      activeSwitchboardIntegration?: { id?: string };
    };
    message?: {
      id?: string;
      _id?: string;
      author?: { type?: string; userId?: string };
      content?: ZendeskContent;
      /** Which channel integration the message came in through (one per brand). */
      source?: { type?: string; integrationId?: string };
    };
  };
}

interface ZendeskWebhookBody {
  events?: ZendeskEvent[];
}

function conversationIdOf(event: ZendeskEvent): string | undefined {
  return event.payload?.conversation?.id ?? event.payload?.conversation?._id;
}

function messageIdOf(event: ZendeskEvent): string | undefined {
  return event.payload?.message?.id ?? event.payload?.message?._id;
}

function defaultTenant(): TenantId {
  const configured = process.env.ZENDESK_TENANT;
  return isTenantId(configured) ? configured : "casino777";
}

/**
 * All three casinos share one Sunshine Conversations app, one web integration
 * per brand, so the integration the message arrived on decides which bot answers.
 * Format: "<integrationId>:<tenant>,<integrationId>:<tenant>".
 */
function tenantByIntegration(): Record<string, TenantId> {
  const raw = process.env.ZENDESK_TENANT_BY_INTEGRATION;
  if (!raw) return {};
  const map: Record<string, TenantId> = {};
  for (const pair of raw.split(",")) {
    const [id, name] = pair.split(":").map((s) => s.trim());
    if (id && isTenantId(name)) map[id] = name;
  }
  return map;
}

function tenantFor(event: ZendeskEvent): TenantId {
  const integrationId = event.payload?.message?.source?.integrationId;
  const mapped = integrationId ? tenantByIntegration()[integrationId] : undefined;
  if (!mapped && integrationId) {
    console.warn("Zendesk: unmapped source integration, using default tenant", { integrationId });
  }
  return mapped ?? defaultTenant();
}

/**
 * Which web integrations (brands) our bot actually serves. The switchboard's
 * default answerer is set per app, not per integration, so with all three
 * casinos in one Sunshine app every conversation reaches us first. Anything
 * outside this list is handed straight back to Zendesk's own answerBot, so the
 * brands we have not gone live with behave exactly as before.
 *
 * Empty or unset means: serve everything.
 */
function servedIntegrations(): string[] {
  return (process.env.ZENDESK_ONLY_INTEGRATIONS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function servesIntegration(integrationId: string | undefined): boolean {
  const allowed = servedIntegrations();
  if (allowed.length === 0) return true;
  // An unknown integration is not ours to answer for: better silent handback
  // than the wrong brand's bot replying.
  if (!integrationId) return false;
  return allowed.includes(integrationId);
}

/** True when our integration currently holds control of the conversation. */
async function botHasControl(
  cfg: ZendeskConfig,
  conversationId: string,
  fromPayload: string | undefined
): Promise<boolean> {
  const active = fromPayload ?? (await getActiveSwitchboardId(cfg, conversationId));
  // No switchboard configured yet (e.g. during first tests): treat as ours.
  if (!active) return true;
  return active === cfg.botSwitchboardId;
}

const FORM_INTRO =
  "Pozdravljeni! Preden nadaljujemo, prosim pustite ime in e-poštni naslov, da vas naša podpora lahko kontaktira, če se pogovor prekine.";

const FORM_REMINDER =
  "Za nadaljevanje pogovora prosim izpolnite ime in e-poštni naslov.";

/**
 * How many times the form is put in front of a guest who hasn't filled it in.
 * The form locks the chat input, so reaching this at all means something got a
 * message through anyway; after this we help them regardless.
 */
const MAX_FORM_PROMPTS = 3;

function contactFromFormResponse(content: ZendeskContent | undefined): {
  name?: string;
  email?: string;
} {
  const contact: { name?: string; email?: string } = {};
  for (const field of content?.fields ?? []) {
    const value = (field.email ?? field.text ?? "").trim();
    if (!value) continue;
    if (field.name === "email" || field.type === "email") contact.email = value;
    else if (field.name === "name" || field.type === "text") contact.name = value;
  }
  return contact;
}

/** Hands the conversation to the agents and leaves a trace in the admin history. */
async function handOverToAgents(
  cfg: ZendeskConfig,
  conversationId: string,
  sessionId: string,
  tenant: TenantId,
  opts: {
    firstMessageId?: string;
    integrationId?: string;
    contact?: { name?: string; email?: string };
    userMessage?: string;
  }
): Promise<void> {
  // Zendesk's own bot owns the pre-chat form on brands where a proactive
  // greeting still runs; elsewhere "next" is Agent Workspace and we are the
  // ones who collected the contact details.
  const target = process.env.ZENDESK_DAYTIME_SWITCHBOARD || "next";
  await passControlToAgent(cfg, conversationId, {
    firstMessageId: opts.firstMessageId,
    target,
    contact: opts.contact,
  });
  // Logged because a silent success looks exactly like a dropped event.
  console.log("Zendesk: handed over", {
    conversationId,
    integrationId: opts.integrationId,
    target,
    withContact: Boolean(opts.contact?.email || opts.contact?.name),
  });
  // Keep a trace in the history, otherwise daytime traffic is invisible in the
  // admin. Never let a bookkeeping failure undo a completed handoff.
  await recordAgentHandoff(sessionId, tenant, opts.userMessage).catch((err) =>
    console.error("Zendesk: handoff not recorded:", err)
  );
}

/** Answers as the bot, re-checking control because generating takes seconds. */
async function replyAsBot(
  cfg: ZendeskConfig,
  conversationId: string,
  sessionId: string,
  tenant: TenantId,
  text: string
): Promise<void> {
  if (text.length > MAX_MESSAGE_LENGTH) return;
  if (await isSessionRateLimited(sessionId)) return;

  let reply: string;
  try {
    await ensureConversation(sessionId, tenant);
    reply = await generateReply(sessionId, text, tenant);
  } catch (err) {
    // generateReply handles Claude failures itself, so this is the store failing.
    // Outside support hours nobody else answers, so still say something.
    console.error("Zendesk reply generation error:", err);
    reply = fallbackReply(tenant);
  }
  if (!reply) return;

  // An agent may have picked the chat up while we were generating, so re-check
  // control before speaking over them.
  if (!(await botHasControl(cfg, conversationId, undefined))) {
    console.log("Zendesk: control changed while generating, dropping reply", { conversationId });
    return;
  }

  await postBusinessMessage(cfg, conversationId, reply);
}

/**
 * Which brands may be greeted the moment the widget opens.
 *
 * A `conversation:create` event names the brand, not the channel integration,
 * so the message-time allowlist (`ZENDESK_ONLY_INTEGRATIONS`) can't be reused.
 * Format: "<brandId>:<tenant>". Unset means: greet nobody on open, which leaves
 * the old behaviour (form on the first message) untouched.
 */
function tenantByBrand(): Record<string, TenantId> {
  const raw = process.env.ZENDESK_TENANT_BY_BRAND;
  if (!raw) return {};
  const map: Record<string, TenantId> = {};
  for (const pair of raw.split(",")) {
    const [id, name] = pair.split(":").map((s) => s.trim());
    if (id && isTenantId(name)) map[id] = name;
  }
  return map;
}

/**
 * Greets the guest and asks for their details the moment they open the widget,
 * before they have written anything.
 *
 * Zendesk creates the conversation when the messenger opens and flags the event
 * with `creationReason: "startConversation"`; their own docs call that the right
 * moment for a bot greeting. Any other reason (including "message") means the
 * guest is already talking, and the message path handles it.
 */
async function handleConversationStart(cfg: ZendeskConfig, event: ZendeskEvent): Promise<void> {
  const conversationId = conversationIdOf(event);
  if (!conversationId) return;

  const reason = event.payload?.creationReason ?? event.payload?.conversation?.creationReason;
  if (reason !== "startConversation") return;

  const brands = tenantByBrand();
  if (Object.keys(brands).length === 0) return;

  const brandId =
    event.payload?.conversation?.brandId ?? (await getConversationBrandId(cfg, conversationId));
  const tenant = brandId ? brands[brandId] : undefined;
  if (!tenant) {
    console.log("Zendesk: new conversation on a brand we don't greet", { conversationId, brandId });
    return;
  }

  const activeFromPayload = event.payload?.conversation?.activeSwitchboardIntegration?.id;
  if (!(await botHasControl(cfg, conversationId, activeFromPayload))) return;

  const sessionId = `zd_${conversationId}`;
  const contact = await loadContact(sessionId);
  if (contact.formSentAt || hasContactDetails(contact)) return;

  try {
    await sendContactForm(cfg, conversationId, FORM_INTRO);
    await saveContact(sessionId, tenant, {
      formSentAt: new Date().toISOString(),
      formPrompts: 1,
    });
    console.log("Zendesk: greeted on open", { conversationId, tenant });
  } catch (err) {
    // The guest has not written anything yet, so nobody is left waiting: let the
    // first message try again rather than marking the form as asked.
    console.error("Zendesk: greeting on open failed:", err);
  }
}

async function handleUserMessage(cfg: ZendeskConfig, event: ZendeskEvent): Promise<void> {
  const conversationId = conversationIdOf(event);
  if (!conversationId) return;

  const message = event.payload?.message;
  const content = message?.content;
  const sessionId = `zd_${conversationId}`;

  const activeFromPayload = event.payload?.conversation?.activeSwitchboardIntegration?.id;
  if (!(await botHasControl(cfg, conversationId, activeFromPayload))) {
    console.log("Zendesk: agent holds control, skipping", { conversationId });
    return;
  }

  const integrationId = message?.source?.integrationId;
  if (!servesIntegration(integrationId)) {
    console.log("Zendesk: brand not served by the bot, handing back", {
      conversationId,
      integrationId,
    });
    const fallback = process.env.ZENDESK_FALLBACK_SWITCHBOARD || "zd-answerBot";
    try {
      await passControlToIntegration(cfg, conversationId, fallback);
    } catch (err) {
      // The conversation must never stay parked on us: we do not answer for
      // this brand, so nobody would. Agent Workspace is the safe landing spot.
      console.error("Zendesk handback failed, passing to agents instead:", err);
      await passControlToAgent(cfg, conversationId, { firstMessageId: messageIdOf(event) });
    }
    return;
  }

  const tenant = tenantFor(event);

  // The guest filled in the pre-chat form: keep the details, then carry on with
  // whatever they wrote before it.
  if (content?.type === "formResponse") {
    const answers = contactFromFormResponse(content);
    const state = await saveContact(sessionId, tenant, answers);
    const userId = message?.author?.userId;
    if (userId) {
      await updateUserProfile(cfg, userId, answers).catch((err) =>
        console.error("Zendesk: guest profile not updated:", err)
      );
    }

    const pending = state.pendingMessage?.trim();
    if (isSupportOpen()) {
      await handOverToAgents(cfg, conversationId, sessionId, tenant, {
        firstMessageId: messageIdOf(event),
        integrationId,
        contact: state,
        userMessage: pending,
      });
      return;
    }
    // Outside support hours the bot answers; the guest should not have to
    // repeat the question they asked before the form.
    if (!pending) {
      await postBusinessMessage(
        cfg,
        conversationId,
        state.name
          ? `Hvala, ${state.name}. Kako vam lahko pomagam?`
          : "Hvala. Kako vam lahko pomagam?"
      );
      return;
    }
    await replyAsBot(cfg, conversationId, sessionId, tenant, pending);
    return;
  }

  const text = content?.type === "text" ? content.text?.trim() : undefined;

  // Name and email come before anything else: the casino wants them the way
  // LiveChat's pre-chat form collected them. The form itself locks the text
  // input, so this only fires for a guest who got a message past it.
  const contact = await loadContact(sessionId);
  if (!hasContactDetails(contact)) {
    const prompts = contact.formPrompts ?? 0;
    if (prompts < MAX_FORM_PROMPTS) {
      try {
        await sendContactForm(cfg, conversationId, prompts === 0 ? FORM_INTRO : FORM_REMINDER);
        await saveContact(sessionId, tenant, {
          formSentAt: new Date().toISOString(),
          formPrompts: prompts + 1,
          // Keep the first question only; later ones would overwrite it.
          ...(contact.pendingMessage ? {} : { pendingMessage: text }),
        });
        return;
      } catch (err) {
        // A form we failed to send must not stall the conversation: count the
        // attempt and fall through to the normal flow.
        console.error("Zendesk: contact form failed, continuing without it:", err);
        await saveContact(sessionId, tenant, {
          formSentAt: new Date().toISOString(),
          formPrompts: prompts + 1,
        });
      }
    } else {
      // Asked enough times. Someone who still won't fill it in gets help
      // anyway — an unanswered guest is worse than a nameless ticket.
      console.log("Zendesk: continuing without contact details", { conversationId, prompts });
    }
  }

  // Support hours → hand over to the agents, don't call the bot at all.
  if (isSupportOpen()) {
    try {
      await handOverToAgents(cfg, conversationId, sessionId, tenant, {
        firstMessageId: messageIdOf(event),
        integrationId,
        contact,
        userMessage: text,
      });
      return;
    } catch (err) {
      console.error("Zendesk passControl failed:", err);
      // Never leave the customer waiting on a handoff that didn't happen —
      // answer as the bot instead. Disable with ZENDESK_REPLY_ON_HANDOFF_FAILURE=0.
      if (process.env.ZENDESK_REPLY_ON_HANDOFF_FAILURE === "0") return;
    }
  }

  if (content?.type && content.type !== "text") {
    await postBusinessMessage(cfg, conversationId, ATTACHMENT_REPLY);
    return;
  }

  if (!text) return;
  await replyAsBot(cfg, conversationId, sessionId, tenant, text);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    // Nothing is processed, but ACK anyway: a 4xx makes Zendesk retry and can
    // get the webhook disabled, and until the first live delivery we can't be
    // sure which signature scheme they use. The header names tell us that.
    console.warn("Zendesk webhook: signature verification failed", {
      signatureHeaders: describeSignatureHeaders(req.headers),
    });
    return NextResponse.json({ ok: true, skipped: "bad-signature" });
  }

  const cfg = getZendeskConfig();
  if (!cfg) {
    // Not provisioned yet. ACK so Zendesk doesn't retry-storm the endpoint.
    console.warn("Zendesk webhook: integration not configured (missing env vars)");
    return NextResponse.json({ ok: true, skipped: "not-configured" });
  }

  let body: ZendeskWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = body.events ?? [];
  let handled = 0;

  // Diagnostics: most events we receive are not user messages, and without this
  // an ignored event is indistinguishable from one that never arrived.
  if (process.env.ZENDESK_TRACE_EVENTS === "1") {
    console.log(
      "Zendesk: events",
      events.map((e) => ({
        type: e.type,
        author: e.payload?.message?.author?.type,
        integrationId: e.payload?.message?.source?.integrationId,
        active: e.payload?.conversation?.activeSwitchboardIntegration?.id,
        conversationId: conversationIdOf(e),
      }))
    );
  }

  for (const event of events) {
    const isNewConversation = event.type === "conversation:create";
    if (!isNewConversation) {
      if (event.type !== "conversation:message") continue;
      if (event.payload?.message?.author?.type !== "user") continue; // ignore our own + agent messages
    }

    const eventId = event.id;
    if (eventId && alreadyHandled(eventId)) continue;

    const conversationId = conversationIdOf(event);
    if (!conversationId) continue;

    handled++;
    try {
      await withConversationLock(conversationId, () =>
        isNewConversation ? handleConversationStart(cfg, event) : handleUserMessage(cfg, event)
      );
    } catch (err) {
      // Logged, but still ACK below: a 5xx makes Zendesk retry the whole batch,
      // which is what caused the LiveChat retry storm.
      console.error("Zendesk webhook processing error:", err);
    }
  }

  return NextResponse.json({ ok: true, received: events.length, handled });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "zendesk-webhook",
    configured: getZendeskConfig() !== null,
    supportOpen: isSupportOpen(),
  });
}
