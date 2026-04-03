"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CALCS, type CalcMeta } from "../lib/calcs";

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  CalcMeta["status"],
  { label: string; bg: string; color: string }
> = {
  ready:   { label: "Ready",       bg: "#eaf4ee", color: "#1a7a4a" },
  wip:     { label: "In Progress", bg: "#fdf4dc", color: "#c47d0e" },
  planned: { label: "Planned",     bg: "#f0f2f7", color: "#6b7a96" },
};

// ─── Search helpers ───────────────────────────────────────────────────────────

function buildSearchIndex(calc: CalcMeta): string {
  return [
    calc.label,
    calc.subtitle,
    calc.category,
    calc.spec,
    calc.group ?? "",
    ...(calc.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function filterCalcs(calcs: CalcMeta[], query: string): CalcMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return calcs;
  const terms = q.split(/\s+/);
  return calcs.filter((calc) => {
    const index = buildSearchIndex(calc);
    return terms.every((term) => index.includes(term));
  });
}

// ─── Grouping helper ──────────────────────────────────────────────────────────

type RenderItem =
  | { kind: "card"; calc: CalcMeta }
  | { kind: "group"; label: string; calcs: CalcMeta[] };

function buildRenderList(calcs: CalcMeta[]): RenderItem[] {
  const list: RenderItem[] = [];
  const seenGroups = new Set<string>();
  for (const calc of calcs) {
    if (!calc.group) {
      list.push({ kind: "card", calc });
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalcSearchHub() {
  const [query, setQuery] = useState("");

  const isSearching = query.trim().length > 0;

  const filteredCalcs = useMemo(
    () => filterCalcs(CALCS, query),
    [query]
  );

  const categories = useMemo(
    () => [...new Set(CALCS.map((c) => c.category))],
    []
  );

  return (
    <>
      {/* Page heading + search bar */}
      <div className="mb-8 max-w-2xl">
        <p
          className="uppercase tracking-widest text-[10px] font-semibold mb-2"
          style={{ color: "var(--are-navy-light)", fontFamily: "var(--font-archivo)" }}
        >
          Anderson Rohr Engineers
        </p>
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
        >
          Structural Calculators
        </h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--are-muted)" }}>
          AISC 360-22 &amp; ACI 318-19 design calculators — live in the browser.
          Select a calculator below or use the sidebar to navigate.
        </p>

        {/* Search input */}
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: "var(--are-muted)" }}
          >
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search calculators — e.g. anchor bolt, pier, diaphragm, RISA…"
            className="w-full pl-8 pr-4 py-2.5 rounded-lg border text-sm outline-none transition-shadow"
            style={{
              background: "var(--are-surface)",
              borderColor: "var(--are-border)",
              color: "var(--are-navy)",
              fontFamily: "var(--font-archivo)",
              boxShadow: "none",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--are-navy-mid)";
              e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--are-navy) 12%, transparent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--are-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {isSearching && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: "var(--are-muted)", fontFamily: "var(--font-archivo)" }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Result count when searching */}
        {isSearching && (
          <p
            className="mt-2 text-[11px]"
            style={{ color: "var(--are-muted)", fontFamily: "var(--font-archivo)" }}
          >
            {filteredCalcs.length === 0
              ? "No calculators matched your search."
              : `${filteredCalcs.length} calculator${filteredCalcs.length === 1 ? "" : "s"} found`}
          </p>
        )}
      </div>

      {/* ── Search results (flat list) ── */}
      {isSearching ? (
        <section>
          {filteredCalcs.length === 0 ? (
            <div
              className="rounded-lg border p-8 text-center text-sm"
              style={{
                background: "var(--are-surface)",
                borderColor: "var(--are-border)",
                color: "var(--are-muted)",
                fontFamily: "var(--font-archivo)",
              }}
            >
              No calculators matched &ldquo;{query}&rdquo;.
              <br />
              <button
                onClick={() => setQuery("")}
                className="mt-2 underline text-xs"
                style={{ color: "var(--are-navy-mid)" }}
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCalcs.map((calc) => (
                <SearchResultCard key={calc.slug} calc={calc} query={query} />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* ── Normal categorized view ── */
        <>
          {categories.map((cat) => {
            const calcs = CALCS.filter((c) => c.category === cat);
            const renderList = buildRenderList(calcs);
            return (
              <section key={cat} className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                  <h3
                    className="uppercase tracking-widest text-[10px] font-bold"
                    style={{
                      color: "var(--are-navy)",
                      fontFamily: "var(--font-archivo)",
                    }}
                  >
                    {cat}
                  </h3>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "var(--are-border)" }}
                  />
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {renderList.map((item) =>
                    item.kind === "card" ? (
                      <CalcCard key={item.calc.slug} calc={item.calc} />
                    ) : (
                      <GroupCard key={item.label} label={item.label} calcs={item.calcs} />
                    )
                  )}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

// ─── SearchResultCard — flat card with category badge ────────────────────────

function SearchResultCard({ calc, query }: { calc: CalcMeta; query: string }) {
  const badge = STATUS_BADGE[calc.status];
  const inner = (
    <div
      className="rounded-lg border p-5 flex flex-col gap-3 h-full transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-0.5"
      style={{
        background: "var(--are-surface)",
        borderColor: "var(--are-border)",
        borderTopWidth: 2,
        borderTopColor: "var(--are-navy)",
      }}
    >
      {/* Category tag */}
      <span
        className="text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--are-navy-light)", fontFamily: "var(--font-archivo)" }}
      >
        {calc.category}{calc.group ? ` · ${calc.group}` : ""}
      </span>

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className="font-bold text-sm leading-snug"
          style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
        >
          {calc.label}
        </h4>
        <span
          className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            background: badge.bg,
            color: badge.color,
            fontFamily: "var(--font-archivo)",
          }}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--are-muted)" }}>
        {calc.subtitle}
      </p>

      <div className="flex items-center justify-between">
        <span
          className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 border rounded"
          style={{
            borderColor: "var(--are-border)",
            color: "var(--are-muted)",
            fontFamily: "var(--font-archivo)",
          }}
        >
          {calc.spec}
        </span>
        {calc.status !== "planned" && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--are-navy-mid)", fontFamily: "var(--font-archivo)" }}
          >
            Open →
          </span>
        )}
      </div>
    </div>
  );

  if (calc.status === "planned") return <div>{inner}</div>;
  return (
    <Link href={`/calcs/${calc.slug}`} className="block group">
      {inner}
    </Link>
  );
}

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({ label, calcs }: { label: string; calcs: CalcMeta[] }) {
  const spec = calcs[0]?.spec ?? "";
  return (
    <details
      className="rounded-lg border overflow-hidden"
      style={{
        background: "var(--are-surface)",
        borderColor: "var(--are-border)",
        borderTopWidth: 2,
        borderTopColor: "var(--are-navy)",
      }}
    >
      <summary
        className="flex flex-col gap-3 p-5 cursor-pointer list-none select-none"
        style={{ WebkitAppearance: "none" } as React.CSSProperties}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <h4
            className="font-bold text-sm leading-snug"
            style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
          >
            {label}
          </h4>
          <span
            className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              background: "#eaf4ee",
              color: "#1a7a4a",
              fontFamily: "var(--font-archivo)",
            }}
          >
            {calcs.length} variants
          </span>
        </div>

        {/* Option names preview */}
        <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--are-muted)" }}>
          {calcs.map((c) => c.label).join(" · ")}
        </p>

        {/* Spec + expand hint */}
        <div className="flex items-center justify-between">
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 border rounded"
            style={{
              borderColor: "var(--are-border)",
              color: "var(--are-muted)",
              fontFamily: "var(--font-archivo)",
            }}
          >
            {spec}
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--are-navy-mid)", fontFamily: "var(--font-archivo)" }}
          >
            Select ▾
          </span>
        </div>
      </summary>

      {/* Expanded options */}
      <div className="border-t flex flex-col" style={{ borderColor: "var(--are-border)" }}>
        {calcs.map((calc, idx) => (
          <Link
            key={calc.slug}
            href={`/calcs/${calc.slug}`}
            className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50"
            style={
              idx < calcs.length - 1
                ? { borderBottom: "1px solid var(--are-border)" }
                : undefined
            }
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                {calc.label}
              </span>
              <span
                className="text-xs leading-snug"
                style={{ color: "var(--are-muted)" }}
              >
                {calc.subtitle}
              </span>
            </div>
            <span
              className="ml-4 shrink-0 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--are-navy-mid)", fontFamily: "var(--font-archivo)" }}
            >
              Open →
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}

// ─── CalcCard ─────────────────────────────────────────────────────────────────

function CalcCard({ calc }: { calc: CalcMeta }) {
  const badge = STATUS_BADGE[calc.status];

  const inner = (
    <div
      className="rounded-lg border p-5 flex flex-col gap-3 h-full transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-0.5"
      style={{
        background: "var(--are-surface)",
        borderColor: "var(--are-border)",
        borderTopWidth: 2,
        borderTopColor: "var(--are-navy)",
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className="font-bold text-sm leading-snug"
          style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
        >
          {calc.label}
        </h4>
        <span
          className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            background: badge.bg,
            color: badge.color,
            fontFamily: "var(--font-archivo)",
          }}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--are-muted)" }}>
        {calc.subtitle}
      </p>

      <div className="flex items-center justify-between">
        <span
          className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 border rounded"
          style={{
            borderColor: "var(--are-border)",
            color: "var(--are-muted)",
            fontFamily: "var(--font-archivo)",
          }}
        >
          {calc.spec}
        </span>
        {calc.status !== "planned" && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--are-navy-mid)", fontFamily: "var(--font-archivo)" }}
          >
            Open →
          </span>
        )}
      </div>
    </div>
  );

  if (calc.status === "planned") return <div>{inner}</div>;

  return (
    <Link href={`/calcs/${calc.slug}`} className="block group">
      {inner}
    </Link>
  );
}
