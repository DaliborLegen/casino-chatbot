// Multi-tenant registry for the admin dashboard (and, later, per-tenant bots).
// Each tenant is one casino brand backed by the same Supabase instance;
// rows are scoped via the `tenant` column on conversations / bot_knowledge /
// daily_insights.

export type TenantId = "casino" | "supercasino" | "casino777";

export interface TenantTheme {
  /** Header bar gradient (brand nav). */
  headerGradient: string;
  /** Primary brand color: buttons, heading underlines. */
  accent: string;
  /** Text color that stays readable on `accent`. */
  accentContrast: string;
  /** Active nav-link color on the header gradient. */
  navActive: string;
  /** Mascot orb gradient in the header. */
  orbGradient: string;
  /** Bot message bubble in conversation view. */
  botBubbleBg: string;
  botBubbleBorder: string;
  botLabel: string;
}

export interface Tenant {
  id: TenantId;
  /** Display name, e.g. "Casino.si". */
  name: string;
  /** Short label for the switcher pill. */
  shortName: string;
  siteUrl: string;
  logoUrl: string;
  /** Where a guest is sent when the bot cannot answer. */
  supportEmail: string;
  theme: TenantTheme;
}

export const TENANTS: Record<TenantId, Tenant> = {
  casino: {
    id: "casino",
    name: "Casino.si",
    shortName: "Casino.si",
    siteUrl: "https://casino.si",
    logoUrl: "https://cnsicdn.kubdev.com/common-content/brand/app-logo--desktop.svg",
    theme: {
      headerGradient: "linear-gradient(90deg, #aa0000 0%, #ff0000 50%, #aa0000 100%)",
      accent: "#ff0000",
      accentContrast: "#ffffff",
      navActive: "#ffe22e",
      orbGradient: "linear-gradient(135deg, #ff3b3b, #aa0000)",
      botBubbleBg: "rgba(255,40,40,0.10)",
      botBubbleBorder: "rgba(255,60,60,0.35)",
      botLabel: "#ff6b6b",
    },
  },
  supercasino: {
    id: "supercasino",
    name: "SuperCasino.si",
    shortName: "SuperCasino",
    siteUrl: "https://supercasino.si",
    logoUrl: "https://spsicdn.kubdev.com/common-content/brand/app-logo--desktop.svg",
    theme: {
      headerGradient: "linear-gradient(90deg, #0645ad 0%, #0d63e8 50%, #0645ad 100%)",
      accent: "#0d63e8",
      accentContrast: "#ffffff",
      navActive: "#ffe100",
      orbGradient: "linear-gradient(135deg, #3b82f6, #0645ad)",
      botBubbleBg: "rgba(40,110,255,0.12)",
      botBubbleBorder: "rgba(60,130,255,0.38)",
      botLabel: "#6ba3ff",
    },
  },
  casino777: {
    id: "casino777",
    name: "777casino.si",
    shortName: "777casino",
    siteUrl: "https://777casino.si",
    logoUrl: "https://b7sicdn.kubdev.com/common-content/brand/app-logo--desktop.svg",
    theme: {
      headerGradient: "linear-gradient(90deg, #14562d 0%, #1e7a3f 50%, #14562d 100%)",
      accent: "#1e7a3f",
      accentContrast: "#ffffff",
      navActive: "#fff30f",
      orbGradient: "linear-gradient(135deg, #2eb45f, #14562d)",
      botBubbleBg: "rgba(46,180,95,0.12)",
      botBubbleBorder: "rgba(60,200,120,0.38)",
      botLabel: "#4ade80",
    },
  },
};

export const DEFAULT_TENANT: TenantId = "casino";
export const TENANT_COOKIE = "admin_tenant";

export function isTenantId(v: string | null | undefined): v is TenantId {
  return v === "casino" || v === "supercasino" || v === "casino777";
}

export function getTenant(id: string | null | undefined): Tenant {
  return TENANTS[isTenantId(id) ? id : DEFAULT_TENANT];
}
