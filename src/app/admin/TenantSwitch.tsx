"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { TENANTS, TENANT_COOKIE, type TenantId } from "@/lib/tenants";

/**
 * Segmented switch between casinos. Persists the choice in a cookie and
 * refreshes the server components so every page re-renders with the selected
 * tenant's data and theme.
 */
export default function TenantSwitch({ current }: { current: TenantId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(id: TenantId) {
    if (id === current) return;
    document.cookie = `${TENANT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="flex items-center rounded-full p-0.5 text-xs font-semibold select-none"
      style={{ background: "rgba(0,0,0,0.28)", opacity: pending ? 0.6 : 1 }}
      role="tablist"
      aria-label="Izbira igralnice"
    >
      {(Object.values(TENANTS)).map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => select(t.id)}
            className="px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer"
            style={
              active
                ? { background: "#ffffff", color: "#111111" }
                : { color: "rgba(255,255,255,0.85)" }
            }
          >
            {t.shortName}
          </button>
        );
      })}
    </div>
  );
}
