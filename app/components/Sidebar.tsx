"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CALCS, type CalcMeta } from "../lib/calcs";

const NAV_SECTIONS = [...new Set(CALCS.map((c) => c.category))];

// ─── Sidebar render-list helper (mirrors page.tsx) ────────────────────────────

type SidebarItem =
  | { kind: "link"; calc: CalcMeta }
  | { kind: "group"; label: string; calcs: CalcMeta[] };

function buildSidebarList(calcs: CalcMeta[]): SidebarItem[] {
  const list: SidebarItem[] = [];
  const seenGroups = new Set<string>();
  for (const calc of calcs) {
    if (!calc.group) {
      list.push({ kind: "link", calc });
    } else if (!seenGroups.has(calc.group)) {
      seenGroups.add(calc.group);
      list.push({
        kind: "group",
        label: calc.group,
        calcs: calcs.filter((c) => c.group === calc.group),
      });
    }
  }
  return list;
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex flex-col select-none"
      style={{
        width: "var(--sidebar-width)",
        height: "100dvh",
        background: "var(--sidebar-bg)",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center px-4 border-b border-white/10 shrink-0"
        style={{ height: "var(--header-height)", background: "#ffffff" }}
      >
        <Image
          src="/2.png"
          alt="Anderson Rohr Engineers"
          width={168}
          height={34}
          style={{ objectFit: "contain", objectPosition: "left" }}
          priority
        />
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-5 px-3 flex flex-col gap-6">
        {/* Hub */}
        <NavLink href="/" label="Calculator Hub" active={pathname === "/"} isHub />

        {/* Sections */}
        {NAV_SECTIONS.map((cat) => {
          const catCalcs = CALCS.filter((c) => c.category === cat);
          const sidebarList = buildSidebarList(catCalcs);
          return (
            <div key={cat}>
              <p
                className="px-2 mb-1.5 uppercase tracking-widest font-semibold"
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "var(--font-archivo)",
                  letterSpacing: "0.12em",
                }}
              >
                {cat}
              </p>
              <div className="flex flex-col gap-0.5">
                {sidebarList.map((item) =>
                  item.kind === "link" ? (
                    <NavLink
                      key={item.calc.slug}
                      href={`/calcs/${item.calc.slug}`}
                      label={item.calc.label}
                      active={pathname === `/calcs/${item.calc.slug}`}
                    />
                  ) : (
                    <SidebarGroup
                      key={item.label}
                      label={item.label}
                      calcs={item.calcs}
                      pathname={pathname}
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t border-white/10 shrink-0"
        style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-archivo)", letterSpacing: "0.08em" }}
      >
        AISC 360-22 · ACI 318-19
      </div>
    </aside>
  );
}

// ─── SidebarGroup ─────────────────────────────────────────────────────────────

function SidebarGroup({
  label,
  calcs,
  pathname,
}: {
  label: string;
  calcs: CalcMeta[];
  pathname: string;
}) {
  const hasActive = calcs.some((c) => pathname === `/calcs/${c.slug}`);

  return (
    <details open={hasActive} className="group/sdet">
      <summary
        className="flex items-center justify-between px-3 py-2 rounded cursor-pointer list-none text-xs font-medium transition-colors"
        style={{
          color: "rgba(255,255,255,0.5)",
          fontFamily: "var(--font-dm-sans)",
          WebkitAppearance: "none",
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span>{label}</span>
        <span
          className="text-[10px] transition-transform group-open/sdet:rotate-180"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          ▾
        </span>
      </summary>

      <div className="flex flex-col gap-0.5 pl-3 pt-0.5">
        {calcs.map((calc) => (
          <NavLink
            key={calc.slug}
            href={`/calcs/${calc.slug}`}
            label={calc.label}
            active={pathname === `/calcs/${calc.slug}`}
          />
        ))}
      </div>
    </details>
  );
}

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({
  href,
  label,
  active,
  isHub = false,
}: {
  href: string;
  label: string;
  active: boolean;
  isHub?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 rounded transition-colors text-xs font-medium"
      style={
        active
          ? {
              background: "var(--are-navy-mid)",
              color: "#fff",
              fontFamily: "var(--font-archivo)",
              letterSpacing: "0.03em",
            }
          : {
              color: isHub ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.5)",
              fontFamily: "var(--font-dm-sans)",
            }
      }
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {label}
    </Link>
  );
}
