"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES: { value: string; label: string }[] = [
  { value: "promocija", label: "Nova promocija" },
  { value: "pravilo", label: "Sprememba pravila" },
  { value: "faq", label: "FAQ vnos" },
];

export default function SubmitForm() {
  const router = useRouter();
  const [type, setType] = useState("promocija");
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [special, setSpecial] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/knowledge/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, title, rawInput, specialInstructions: special }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || "Napaka pri pošiljanju." });
      } else {
        const emailNote = data.emailSent
          ? "Poslano v potrditev po emailu."
          : "Shranjeno (email obvestilo ni bilo poslano — potrdi spodaj v seznamu).";
        setMsg({ kind: "ok", text: `Vnos je shranjen in čaka potrditev. ${emailNote}` });
        setTitle("");
        setRawInput("");
        setSpecial("");
        router.refresh();
      }
    } catch {
      setMsg({ kind: "err", text: "Napaka pri povezavi. Poskusite znova." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
            Tip
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
            Naslov (neobvezno)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="npr. Vikend bonus"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
          Vsebina / pravilo <span className="text-zinc-600 normal-case">— opišite promocijo, kode, igre, zneske, pogoje</span>
        </label>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={6}
          required
          placeholder="Vsak vikend igralci ob prvi prijavi prejmejo ... Koda: ... Bonus: ... Wagering: ... Max izplačilo: ..."
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none resize-y"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
          Posebna navodila botu (neobvezno)
        </label>
        <input
          value={special}
          onChange={(e) => setSpecial(e.target.value)}
          placeholder="npr. ne omenjaj proaktivno; usmeri na podporo; ekskluzivno"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none"
        />
      </div>

      {msg && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-emerald-950/50 border border-emerald-800 text-emerald-300"
              : "bg-red-950/50 border border-red-800 text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#ff0000" }}
        >
          {busy ? "Pošiljam…" : "Pošlji v potrditev"}
        </button>
        <span className="text-xs text-zinc-500">
          Vnos gre v živo šele po potrditvi lastnika.
        </span>
      </div>
    </form>
  );
}
