import { NextRequest, NextResponse } from "next/server";
import { decideEntry, getById, setEntryActive } from "@/lib/knowledge";
import { getTenant, TENANT_COOKIE } from "@/lib/tenants";

export const runtime = "nodejs";

function basicAuthUser(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(auth.slice(6));
    const idx = decoded.indexOf(":");
    return idx >= 0 ? decoded.slice(0, idx) : decoded;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let payload: { id?: string; action?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Neveljaven JSON." }, { status: 400 });
  }

  const id = (payload.id || "").trim();
  const action = payload.action;
  const ACTIONS = ["approve", "reject", "deactivate", "activate"];
  if (!id || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Manjka id ali veljavna akcija." }, { status: 400 });
  }

  // Strict tenant isolation: an entry may only be decided from the dashboard
  // of the casino it belongs to.
  const tenant = getTenant(req.cookies.get(TENANT_COOKIE)?.value);
  const existing = await getById(id);
  if (!existing) {
    return NextResponse.json({ error: "Vnos ne obstaja." }, { status: 404 });
  }
  if ((existing.tenant || "casino") !== tenant.id) {
    return NextResponse.json(
      { error: "Vnos pripada drugi igralnici — preklopite na pravo igralnico." },
      { status: 403 }
    );
  }

  const status = action === "approve" ? "active" : "rejected";
  const { entry, alreadyDecided } = await decideEntry(id, status, basicAuthUser(req) || "admin");

  if (!entry) {
    return NextResponse.json({ error: "Vnos ne obstaja." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: entry.status, alreadyDecided });
}
