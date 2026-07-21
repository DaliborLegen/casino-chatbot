"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Pogovori", match: (p: string) => !p.startsWith("/admin/pravila") && !p.startsWith("/admin/insights") },
  { href: "/admin/pravila", label: "Pravila in promocije", match: (p: string) => p.startsWith("/admin/pravila") },
  { href: "/admin/insights", label: "Dnevna analiza", match: (p: string) => p.startsWith("/admin/insights") },
];

export default function AdminNav() {
  const path = usePathname() || "/admin";
  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            className="px-2.5 sm:px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors"
            style={
              active
                ? { color: "var(--nav-active)", background: "rgba(0,0,0,0.22)" }
                : { color: "rgba(255,255,255,0.88)" }
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
