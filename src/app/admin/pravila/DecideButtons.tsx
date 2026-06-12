"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DecideButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
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
      <button
        onClick={() => decide("approve")}
        disabled={busy !== null}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {busy === "approve" ? "…" : "✅ Potrdi"}
      </button>
      <button
        onClick={() => decide("reject")}
        disabled={busy !== null}
        className="rounded-md bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {busy === "reject" ? "…" : "❌ Zavrni"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
