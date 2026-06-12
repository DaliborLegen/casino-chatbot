import { NextRequest } from "next/server";
import { verifyDecisionToken, decideEntry, getById } from "@/lib/knowledge";

export const runtime = "nodejs";

// One-click approve/reject from the operator's email. Not behind admin Basic auth
// (so it works from a phone without login) — authorized solely by the HMAC token
// that binds the entry id and the action.

function page(title: string, message: string, color: string): Response {
  const html = `<!DOCTYPE html>
<html lang="sl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center">
  <div style="max-width:480px;padding:36px 32px;background:#161616;border:1px solid #2a2a2a;border-radius:12px;text-align:center">
    <div style="font-size:40px;line-height:1;margin-bottom:14px">${color === "green" ? "✅" : color === "red" ? "❌" : "ℹ️"}</div>
    <h1 style="margin:0 0 10px 0;font-size:20px;color:#fafafa">${title}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:#a3a3a3">${message}</p>
    <a href="https://chat-bot.bet/admin/pravila" style="display:inline-block;color:#38bdf8;text-decoration:none;font-size:14px">Odpri nadzorno ploščo →</a>
  </div>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = (sp.get("id") || "").trim();
  const action = sp.get("action");
  const token = sp.get("token") || "";

  if (!id || (action !== "approve" && action !== "reject")) {
    return page("Neveljavna povezava", "Manjka veljaven id ali akcija.", "info");
  }
  if (!verifyDecisionToken(id, action, token)) {
    return page("Neveljavna povezava", "Žeton ni veljaven ali je potekel.", "info");
  }

  const status = action === "approve" ? "active" : "rejected";
  const { entry, alreadyDecided } = await decideEntry(id, status, "email-link");

  if (!entry) {
    const existing = await getById(id);
    if (!existing) return page("Vnos ne obstaja", "Tega vnosa ni mogoče najti.", "info");
    return page("Napaka", "Vnosa ni bilo mogoče obdelati.", "info");
  }

  if (alreadyDecided) {
    const statusLabel =
      entry.status === "active" ? "že potrjen in objavljen" : entry.status === "rejected" ? "že zavrnjen" : entry.status;
    return page("Vnos je že obravnavan", `Vnos »${entry.title}« je ${statusLabel}.`, "info");
  }

  if (action === "approve") {
    return page("Potrjeno in objavljeno", `Vnos »${entry.title}« je zdaj aktiven — bot ga upošteva v nekaj sekundah.`, "green");
  }
  return page("Zavrnjeno", `Vnos »${entry.title}« je zavrnjen in ne bo objavljen.`, "red");
}
