"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "approve" | "reject" | "deactivate" | "activate";

const LABELS: Record<Action, string> = {
  approve: "✅ Potrdi",
  reject: "❌ Zavrni",
  deactivate: "Izklopi",
  activate: "Vklopi nazaj",
};

const STYLES: Record<Action, string> = {
  approve: "bg-emerald-700 hover:bg-emerald-600",
  reject: "bg-red-800 hover:bg-red-700",
  deactivate: "bg-zinc-700 hover:bg-zinc-600",
  activate: "bg-emerald-700 hover:bg-emerald-600",
};

export default function DecideButtons({
  id,
  actions = ["approve", "reject"],
}: {
  id: string;
  actions?: Action[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(action: Action) {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/admin/knowledge/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Napaka.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setErr("Napaka pri povezavi.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      {actions.map((action) => (
        <button
          key={action}
          onClick={() => decide(action)}
          disabled={busy !== null}
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${STYLES[action]}`}
        >
          {busy === action ? "…" : LABELS[action]}
        </button>
      ))}
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
