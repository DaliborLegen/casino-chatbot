import { isExpired, listEntries, type KnowledgeEntry } from "@/lib/knowledge";
import { getAdminTenant } from "@/lib/admin-tenant";
import SubmitForm from "./SubmitForm";
import DecideButtons from "./DecideButtons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(d: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function fmtDay(d: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

const TYPE_LABEL: Record<string, string> = {
  promocija: "Promocija",
  pravilo: "Pravilo",
  faq: "FAQ",
};

function EntryCard({ entry }: { entry: KnowledgeEntry }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-200">
              {TYPE_LABEL[entry.type] || entry.type}
            </span>
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{entry.title}</h3>
          </div>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{entry.body}</p>
          {entry.special_instructions && (
            <p className="mt-2 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900/50 rounded px-2 py-1.5">
              <span className="font-medium">Posebno navodilo:</span> {entry.special_instructions}
            </p>
          )}
          <div className="mt-2 text-xs text-zinc-500">
            {entry.submitted_by ? `Vnesel ${entry.submitted_by} · ` : ""}
            {fmt(entry.created_at)}
            {entry.decided_at ? ` · obravnavano ${fmt(entry.decided_at)}${entry.decided_by ? ` (${entry.decided_by})` : ""}` : ""}
          </div>
        </div>
        {entry.status === "pending" && (
          <div className="shrink-0 w-28">
            <DecideButtons id={entry.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  entries,
  emptyText,
}: {
  title: string;
  hint?: string;
  entries: KnowledgeEntry[];
  emptyText: string;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <span className="text-sm text-zinc-500">{entries.length}</span>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-600">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function PravilaPage() {
  const tenant = await getAdminTenant();
  const all = await listEntries(200, tenant.id);
  const pending = all.filter((e) => e.status === "pending");
  const active = all.filter((e) => e.status === "active");
  const rejected = all.filter((e) => e.status === "rejected");

  return (
    <div className="text-zinc-100 px-4 sm:px-5 py-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">
            Pravila in promocije
            <span className="ml-3 align-middle inline-block h-1 w-10 rounded-full" style={{ background: "var(--accent)" }} />
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {tenant.name}: vnesite novo promocijo ali spremembo pravila. Vnos gre botu v živo šele po
            potrditvi — potrdite ga lahko tu ali prek emaila. Brez novega deploya.
          </p>
        </header>

        <SubmitForm />

        {pending.length > 0 && (
          <Section
            title="Čaka potrditev"
            hint="bot tega še ne uporablja"
            entries={pending}
            emptyText="Nič v čakanju."
          />
        )}

        <Section
          title="Aktivno"
          hint="bot to upošteva v živo"
          entries={active}
          emptyText="Še ni aktivnih dinamičnih vnosov. Jedrna pravila in FAQ ostajajo v kodi."
        />

        {rejected.length > 0 && (
          <Section title="Zavrnjeno" entries={rejected} emptyText="—" />
        )}
      </div>
    </div>
  );
}
