import { Resend } from "resend";
import type { InsightResult } from "@/lib/insights";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineEmail(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(
    /`([^`]+)`/g,
    '<code style="padding:1px 5px;border-radius:3px;background:#f1f1f1;font-family:Menlo,Consolas,monospace;font-size:13px;color:#222">$1</code>'
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#111;font-weight:600">$1</strong>');
  out = out.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0b66c2;text-decoration:underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return out;
}

export function renderMarkdownForEmail(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listOpen = false;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    out.push(
      `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;color:#222">${renderInlineEmail(paraBuf.join(" "))}</p>`
    );
    paraBuf = [];
  };
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("### ")) {
      flushPara();
      closeList();
      out.push(
        `<h3 style="margin:18px 0 8px 0;font-size:15px;font-weight:600;color:#111">${renderInlineEmail(line.slice(4))}</h3>`
      );
    } else if (line.startsWith("## ")) {
      flushPara();
      closeList();
      out.push(
        `<h2 style="margin:24px 0 12px 0;padding-bottom:6px;border-bottom:1px solid #e5e5e5;font-size:17px;font-weight:600;color:#111">${renderInlineEmail(line.slice(3))}</h2>`
      );
    } else if (line.startsWith("# ")) {
      flushPara();
      closeList();
      out.push(
        `<h1 style="margin:24px 0 12px 0;font-size:20px;font-weight:600;color:#111">${renderInlineEmail(line.slice(2))}</h1>`
      );
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!listOpen) {
        out.push('<ul style="margin:0 0 12px 0;padding-left:22px">');
        listOpen = true;
      }
      out.push(
        `<li style="margin:4px 0;font-size:14px;line-height:1.55;color:#222">${renderInlineEmail(line.replace(/^[-*]\s+/, ""))}</li>`
      );
    } else if (line === "---") {
      flushPara();
      closeList();
      out.push('<hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />');
    } else if (line === "") {
      flushPara();
      closeList();
    } else {
      closeList();
      paraBuf.push(line);
    }
  }
  flushPara();
  closeList();
  return out.join("\n");
}

function buildHtml(result: InsightResult, adminUrl: string): string {
  const body = renderMarkdownForEmail(result.markdown);
  return `<!DOCTYPE html>
<html lang="sl">
<head>
<meta charset="utf-8" />
<title>Casino.si AI chatbot — dnevna analiza ${result.report_date}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #e5e5e5;background:#fafafa">
              <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Casino.si AI chatbot</div>
              <div style="font-size:18px;font-weight:600;color:#111">Dnevna analiza — ${result.report_date}</div>
              <div style="font-size:13px;color:#666;margin-top:6px">
                Pogovorov: <strong style="color:#222">${result.stats.conversation_count}</strong> &nbsp;·&nbsp;
                Sporočil: <strong style="color:#222">${result.stats.message_count}</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e5e5e5;background:#fafafa;font-size:12px;color:#666">
              <div style="margin-bottom:6px">
                Celotno poročilo (in arhiv): <a href="${adminUrl}" style="color:#0b66c2;text-decoration:underline" target="_blank" rel="noopener noreferrer">${adminUrl}</a>
              </div>
              <div>
                Poročilo pripravil model <code style="font-family:Menlo,Consolas,monospace;font-size:11px">${escapeHtml(result.stats.model)}</code> &nbsp;·&nbsp;
                Powered by <a href="https://aiprosolutions.si" style="color:#0b66c2;text-decoration:underline" target="_blank" rel="noopener noreferrer">AIPROSOLUTIONS.SI</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailSendResult {
  sent: boolean;
  skippedReason?: string;
  resendId?: string;
  error?: string;
}

export async function sendInsightEmail(result: InsightResult): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INSIGHTS_EMAIL_TO;
  const from = process.env.INSIGHTS_EMAIL_FROM;

  if (!apiKey) return { sent: false, skippedReason: "RESEND_API_KEY not set" };
  if (!to) return { sent: false, skippedReason: "INSIGHTS_EMAIL_TO not set" };
  if (!from) return { sent: false, skippedReason: "INSIGHTS_EMAIL_FROM not set" };

  const cc = process.env.INSIGHTS_EMAIL_CC
    ? process.env.INSIGHTS_EMAIL_CC.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const replyTo = process.env.INSIGHTS_EMAIL_REPLY_TO
    ? process.env.INSIGHTS_EMAIL_REPLY_TO.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const adminBase = process.env.INSIGHTS_ADMIN_BASE_URL || "https://chat-bot.bet";
  const adminUrl = `${adminBase}/admin/insights/${result.report_date}`;

  const html = buildHtml(result, adminUrl);
  const text = `Casino.si AI chatbot — dnevna analiza ${result.report_date}

Pogovorov: ${result.stats.conversation_count} | Sporočil: ${result.stats.message_count}

${result.markdown}

---
Celotno poročilo: ${adminUrl}
Model: ${result.stats.model}`;

  const subject = `Casino.si AI chatbot — dnevna analiza ${result.report_date}`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      cc,
      replyTo,
      subject,
      html,
      text,
    });
    if (error) {
      return { sent: false, error: error.message || JSON.stringify(error) };
    }
    return { sent: true, resendId: data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
