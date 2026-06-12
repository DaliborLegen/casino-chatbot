import { Resend } from "resend";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { signDecisionToken } from "@/lib/knowledge";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailSendResult {
  sent: boolean;
  skippedReason?: string;
  resendId?: string;
  error?: string;
}

function notifyRecipients(): string[] {
  const raw =
    process.env.KNOWLEDGE_NOTIFY_TO ||
    process.env.INSIGHTS_EMAIL_CC ||
    process.env.INSIGHTS_EMAIL_REPLY_TO ||
    process.env.INSIGHTS_EMAIL_TO ||
    "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Emails the operator a preview of a pending knowledge entry with one-click
 * Approve / Reject links (HMAC-signed, no login needed). Non-fatal: if Resend
 * or the approval secret isn't configured, the entry still sits in 'pending'
 * and can be decided from the /admin/pravila dashboard.
 */
export async function sendApprovalEmail(entry: KnowledgeEntry): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INSIGHTS_EMAIL_FROM;
  const to = notifyRecipients();

  if (!apiKey) return { sent: false, skippedReason: "RESEND_API_KEY not set" };
  if (!from) return { sent: false, skippedReason: "INSIGHTS_EMAIL_FROM not set" };
  if (to.length === 0) return { sent: false, skippedReason: "no notify recipient configured" };

  const base = process.env.INSIGHTS_ADMIN_BASE_URL || "https://chat-bot.bet";
  const approveToken = signDecisionToken(entry.id, "approve");
  const rejectToken = signDecisionToken(entry.id, "reject");
  const dashboardUrl = `${base}/admin/pravila`;

  const hasLinks = !!(approveToken && rejectToken);
  const approveUrl = `${base}/api/knowledge/decision?id=${entry.id}&action=approve&token=${approveToken}`;
  const rejectUrl = `${base}/api/knowledge/decision?id=${entry.id}&action=reject&token=${rejectToken}`;

  const special = entry.special_instructions?.trim();
  const submittedBy = entry.submitted_by?.trim() || "casino.si";

  const buttonsHtml = hasLinks
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px 0">
        <tr>
          <td style="padding-right:10px">
            <a href="${approveUrl}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:6px" target="_blank" rel="noopener noreferrer">✅ Potrdi in objavi</a>
          </td>
          <td>
            <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:6px" target="_blank" rel="noopener noreferrer">❌ Zavrni</a>
          </td>
        </tr>
      </table>`
    : `<p style="margin:0 0 12px 0;font-size:13px;color:#b00020">Potrditev prek povezave ni nastavljena (manjka KNOWLEDGE_APPROVAL_SECRET). Potrdi v nadzorni plošči.</p>`;

  const html = `<!DOCTYPE html>
<html lang="sl"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0"><tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden">
      <tr><td style="padding:20px 28px;border-bottom:1px solid #e5e5e5;background:#fafafa">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Casino.si AI chatbot — v potrditev</div>
        <div style="font-size:18px;font-weight:600;color:#111">${escapeHtml(entry.title)}</div>
        <div style="font-size:13px;color:#666;margin-top:6px">Tip: <strong style="color:#222">${escapeHtml(entry.type)}</strong> &nbsp;·&nbsp; Vnesel: <strong style="color:#222">${escapeHtml(submittedBy)}</strong></div>
      </td></tr>
      <tr><td style="padding:20px 28px">
        <p style="margin:0 0 8px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Tako bo bot uporabil vsebino:</p>
        <div style="font-size:14px;line-height:1.6;color:#222;background:#f8f8f8;border:1px solid #eee;border-radius:6px;padding:14px 16px;white-space:pre-wrap">${escapeHtml(entry.body)}</div>
        ${special ? `<p style="margin:14px 0 0 0;font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px"><strong>Posebno navodilo:</strong> ${escapeHtml(special)}</p>` : ""}
        <p style="margin:18px 0 6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Surov vnos</p>
        <div style="font-size:13px;line-height:1.55;color:#555;white-space:pre-wrap">${escapeHtml(entry.raw_input || "—")}</div>
        <div style="margin-top:22px">${buttonsHtml}</div>
        <p style="margin:14px 0 0 0;font-size:12px;color:#888">Potrjeni vnos gre botu v živo v nekaj sekundah, brez novega deploya. Pregled vseh vnosov: <a href="${dashboardUrl}" style="color:#0b66c2" target="_blank" rel="noopener noreferrer">${dashboardUrl}</a></p>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e5e5e5;background:#fafafa;font-size:12px;color:#666">
        Powered by <a href="https://aiprosolutions.si" style="color:#0b66c2;text-decoration:underline" target="_blank" rel="noopener noreferrer">AIPROSOLUTIONS.SI</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = `Casino.si AI chatbot — vnos v potrditev

Naslov: ${entry.title}
Tip: ${entry.type}
Vnesel: ${submittedBy}

Vsebina (kot jo bo uporabil bot):
${entry.body}
${special ? `\nPosebno navodilo: ${special}` : ""}

Surov vnos:
${entry.raw_input || "—"}

${hasLinks ? `Potrdi in objavi: ${approveUrl}\nZavrni: ${rejectUrl}` : "Potrditev prek povezave ni nastavljena — potrdi v nadzorni plošči."}
Nadzorna plošča: ${dashboardUrl}`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Casino.si chatbot — v potrditev: ${entry.title}`,
      html,
      text,
    });
    if (error) return { sent: false, error: error.message || JSON.stringify(error) };
    return { sent: true, resendId: data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
