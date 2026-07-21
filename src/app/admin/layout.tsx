import AdminNav from "./AdminNav";
import TenantSwitch from "./TenantSwitch";
import { getAdminTenant } from "@/lib/admin-tenant";

export async function generateMetadata() {
  const tenant = await getAdminTenant();
  return { title: `${tenant.name} — Administracija` };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getAdminTenant();
  const t = tenant.theme;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={
        {
          background: "#1c1d1e",
          "--accent": t.accent,
          "--accent-contrast": t.accentContrast,
          "--nav-active": t.navActive,
          "--bot-bubble-bg": t.botBubbleBg,
          "--bot-bubble-border": t.botBubbleBorder,
          "--bot-label": t.botLabel,
        } as React.CSSProperties
      }
    >
      {/* Brand header — tenant gradient nav with the tenant's official logo */}
      <header className="sticky top-0 z-30 shadow-lg" style={{ background: t.headerGradient }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-[58px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* AI assistant mascot — same orb + chat glyph as the live widget */}
            <div
              className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center shrink-0 ring-1 ring-white/30"
              style={{ background: t.orbGradient }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <img src={tenant.logoUrl} alt={tenant.name} className="h-7 sm:h-8" />
            <span className="hidden md:inline text-white/90 text-sm font-medium border-l border-white/30 pl-3 whitespace-nowrap">
              AI Podpora · Administracija
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <TenantSwitch current={tenant.id} />
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      {/* Footer — matches the public site's powered-by line */}
      <footer
        className="mt-auto py-4 px-6 text-center"
        style={{ background: "#161718", borderTop: "1px solid #2a2a2a" }}
      >
        <a
          href="https://aiprosolutions.si"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs hover:underline"
          style={{ color: "#848383" }}
        >
          Powered by <span className="font-bold" style={{ color: "var(--accent)" }}>AIPROSOLUTIONS.SI</span>
        </a>
      </footer>
    </div>
  );
}
