"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CALCS, type CalcMeta } from "../lib/calcs";
import CalcIcon from "./CalcIcon";

// ─── Constants ────────────────────────────────────────────────────────────────

const CALC_TYPE_ORDER: CalcMeta["calcType"][] = [
  "Lateral Loads",
  "Diaphragms & Shear Walls",
  "Beams & Flexure",
  "Columns & Compression",
  "Walls",
  "Connections",
  "Base Plates & Bearing",
  "Anchors & Development",
  "Foundations & Piers",
];

// Material top-border accent colors (matches mock mat-* classes)
const MATERIAL_COLOR: Record<CalcMeta["material"], string> = {
  "Steel":             "var(--are-navy)",
  "Concrete":          "#6b7db3",
  "Masonry":           "#a85c2a",
  "Wood":              "#7a5c36",
  "Cold-Formed Steel": "var(--are-navy-mid)",
  "Loads":             "var(--are-muted)",
};

const STATUS: Record<CalcMeta["status"], { label: string; bg: string; color: string }> = {
  ready:   { label: "Ready",       bg: "#eaf4ee", color: "var(--are-ok)" },
  wip:     { label: "In Progress", bg: "#fdf4dc", color: "var(--are-warn)" },
  planned: { label: "Planned",     bg: "#f0f2f7", color: "var(--are-muted)" },
};

// ─── Groups that collapse into a single expandable tile ───────────────────────

const GROUPED_NAMES = new Set([
  "HSS Connections",
  "CMU Walls",
  "Base Plate Designers",
  "CMU Openings",
  "CMU Connections",
  "CFS Members",
  "CFS Connections",
  "Drilled Pier Designers",
]);

// ─── Search helpers ───────────────────────────────────────────────────────────

function buildSearchIndex(calc: CalcMeta): string {
  return [calc.label, calc.subtitle, calc.category, calc.spec, calc.group ?? "", ...(calc.keywords ?? [])]
    .join(" ")
    .toLowerCase();
}

function filterCalcs(calcs: CalcMeta[], query: string): CalcMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return calcs;
  const terms = q.split(/\s+/);
  return calcs.filter((c) => {
    const idx = buildSearchIndex(c);
    return terms.every((t) => idx.includes(t));
  });
}

// ─── Render-list helpers ──────────────────────────────────────────────────────

type RenderItem =
  | { kind: "card"; calc: CalcMeta }
  | { kind: "group"; label: string; calcs: CalcMeta[] };

function buildRenderList(calcs: CalcMeta[]): RenderItem[] {
  const list: RenderItem[] = [];
  const seenGroups = new Set<string>();
  for (const calc of calcs) {
    if (!calc.group || !GROUPED_NAMES.has(calc.group)) {
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

// ─── CalcSearchHub ────────────────────────────────────────────────────────────

export default function CalcSearchHub() {
  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  const filteredCalcs = useMemo(() => filterCalcs(CALCS, query), [query]);

  return (
    <div className="grid" style={{ gridTemplateColumns: "min(340px, 38%) 1fr", alignItems: "start" }}>

      {/* ── Brand column ──────────────────────────────────────────────── */}
      <aside
        className="border-r pr-10"
        style={{
          borderColor: "var(--are-border-soft)",
          position: "sticky",
          top: "calc(var(--header-height) + 2.5rem)",
          alignSelf: "start",
        }}
      >
        {/* Firm name */}
        <h2
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "1.875rem",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: "var(--are-navy)",
            marginBottom: "0.75rem",
          }}
        >
          Anderson Rohr
          <br />
          Engineers
        </h2>

        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.9375rem",
            fontWeight: 400,
            lineHeight: 1.55,
            color: "var(--are-muted)",
            marginBottom: "1.25rem",
            maxWidth: "28ch",
          }}
        >
          AISC 360-22 &amp; ACI 318-19 structural design calculators - live in the browser.
        </p>

        {/* Spec badges */}
        <div className="flex flex-wrap gap-2 mb-7">
          {["AISC 360-22", "ACI 318-19"].map((spec) => (
            <span
              key={spec}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--are-muted)",
                background: "var(--are-warmwhite)",
                border: "1px solid var(--are-border)",
                borderRadius: "0.25rem",
                padding: "0.25rem 0.625rem",
              }}
            >
              {spec}
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <label htmlFor="calc-search" className="sr-only">
            Search calculators
          </label>
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none select-none"
            style={{ color: "var(--are-muted)", fontSize: "0.9375rem" }}
          >
            &#8981;
          </span>
          <input
            id="calc-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search - anchor bolt, diaphragm..."
            className="w-full pl-8 py-2.5 rounded-md border text-sm are-focus-ring"
            style={{
              paddingRight: isSearching ? "2.25rem" : "0.75rem",
              background: "var(--are-surface)",
              borderColor: "var(--are-border)",
              color: "var(--are-navy)",
              fontFamily: "var(--font-dm-sans)",
            }}
          />
          {isSearching && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 are-focus-ring rounded px-1"
              style={{
                color: "var(--are-muted)",
                fontSize: "0.625rem",
                lineHeight: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">&#x2715;</span>
            </button>
          )}
        </div>

        {isSearching && (
          <p className="text-xs" style={{ color: "var(--are-muted)", fontFamily: "var(--font-dm-sans)" }}>
            {filteredCalcs.length === 0
              ? "No calculators matched."
              : `${filteredCalcs.length} calculator${filteredCalcs.length === 1 ? "" : "s"} found`}
          </p>
        )}
      </aside>

      {/* ── Calc grid ─────────────────────────────────────────────────── */}
      <div className="pl-10">
        {isSearching ? (
          <SearchResults calcs={filteredCalcs} query={query} onClear={() => setQuery("")} />
        ) : (
          <BrowseView />
        )}
      </div>
    </div>
  );
}

// ─── Browse view: grouped by calcType then material ───────────────────────────

function BrowseView() {
  return (
    <>
      {CALC_TYPE_ORDER.map((calcType) => {
        const calcsInType = CALCS.filter((c) => c.calcType === calcType);
        if (!calcsInType.length) return null;

        // Group by material within this calcType (in order of first appearance)
        const materials = [...new Set(calcsInType.map((c) => c.material))];
        const sectionId = `ct-${calcType.replace(/[^\w]+/g, "-").toLowerCase()}`;

        return (
          <section key={calcType} className="mb-10" aria-labelledby={sectionId}>
            {/* CalcType heading with rule */}
            <div className="flex items-center gap-4 mb-4">
              <h3
                id={sectionId}
                className="shrink-0"
                style={{
                  fontFamily: "var(--font-archivo)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--are-navy)",
                  letterSpacing: 0,
                }}
              >
                {calcType}
              </h3>
              <div className="flex-1 h-px" style={{ background: "var(--are-border)" }} />
            </div>

            {/* Material sub-groups */}
            {materials.map((mat) => {
              const calcsInMat = calcsInType.filter((c) => c.material === mat);
              const renderList = buildRenderList(calcsInMat);

              return (
                <div key={mat} className="mb-4">
                  {/* Material label — small uppercase eyebrow */}
                  <div
                    style={{
                      fontFamily: "var(--font-archivo)",
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color: "var(--are-navy-light,#4a6bb5)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {mat}
                  </div>

                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}
                  >
                    {renderList.map((item) =>
                      item.kind === "card" ? (
                        <CalcTile key={item.calc.slug} calc={item.calc} />
                      ) : (
                        <GroupTile key={item.label} label={item.label} calcs={item.calcs} />
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

// ─── Search results: flat icon-tile grid with calcType/material hint ──────────

function SearchResults({
  calcs,
  query,
  onClear,
}: {
  calcs: CalcMeta[];
  query: string;
  onClear: () => void;
}) {
  if (!calcs.length) {
    return (
      <div
        className="rounded-md border p-8 text-center"
        style={{ background: "var(--are-surface)", borderColor: "var(--are-border)" }}
      >
        <p className="text-sm mb-2" style={{ color: "var(--are-charcoal-lt)", fontFamily: "var(--font-dm-sans)" }}>
          No calculators matched &ldquo;{query}&rdquo;.
        </p>
        <button
          onClick={onClear}
          className="text-xs underline are-focus-ring rounded"
          style={{ color: "var(--are-navy-mid)", background: "none", border: "none", cursor: "pointer" }}
        >
          Clear search
        </button>
      </div>
    );
  }

  // In search mode, deduplicate grouped calcs to one tile per group
  const seen = new Set<string>();
  const items: RenderItem[] = [];
  for (const calc of calcs) {
    if (!calc.group || !GROUPED_NAMES.has(calc.group)) {
      items.push({ kind: "card", calc });
    } else if (!seen.has(calc.group)) {
      seen.add(calc.group);
      items.push({
        kind: "group",
        label: calc.group,
        calcs: CALCS.filter((c) => c.group === calc.group),
      });
    }
  }

  return (
    <section aria-label="Search results">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}
      >
        {items.map((item) =>
          item.kind === "card" ? (
            <CalcTile key={item.calc.slug} calc={item.calc} showHint />
          ) : (
            <GroupTile key={item.label} label={item.label} calcs={item.calcs} showHint />
          )
        )}
      </div>
    </section>
  );
}

// ─── CalcTile — icon + label + spec + status badge ───────────────────────────

function CalcTile({ calc, showHint = false }: { calc: CalcMeta; showHint?: boolean }) {
  const badge = STATUS[calc.status];
  const accentColor = MATERIAL_COLOR[calc.material];

  const cardBg =
    calc.status === "planned" ? "var(--are-offwhite)"
    : calc.status === "wip"    ? "#fdf8f2"
    :                            "var(--are-surface)";

  const inner = (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "0.75rem",
        alignItems: "flex-start",
        padding: "0.875rem",
        background: cardBg,
        border: `1px solid ${calc.status === "planned" ? "var(--are-border-soft)" : "var(--are-border)"}`,
        borderTop: `2px solid ${calc.status === "planned" ? "var(--are-border-soft)" : accentColor}`,
        borderRadius: "0.375rem",
        cursor: calc.status === "planned" ? "default" : "pointer",
        transition:
          calc.status === "ready"
            ? "transform 150ms ease-out, box-shadow 150ms ease-out"
            : undefined,
        height: "100%",
        boxSizing: "border-box",
      }}
      className={calc.status === "ready" ? "group-hover:-translate-y-px group-hover:shadow-md" : ""}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CalcIcon
          icon={calc.icon}
          size={48}
        />
      </div>

      {/* Text body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* calcType/material hint in search results */}
        {showHint && (
          <div
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.5625rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--are-navy-light,#4a6bb5)",
              marginBottom: "0.2rem",
            }}
          >
            {calc.calcType} &middot; {calc.material}
          </div>
        )}

        {/* Label */}
        <div
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: calc.status === "planned" ? "var(--are-charcoal-lt)" : "var(--are-navy)",
            lineHeight: 1.2,
            marginBottom: "0.25rem",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}
        >
          {calc.label}
        </div>

        {/* Spec */}
        <div
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.5625rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--are-muted)",
            marginBottom: "0.25rem",
          }}
        >
          {calc.spec}
        </div>

        {/* Status badge */}
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-archivo)",
            fontSize: "0.5rem",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            padding: "0.1rem 0.35rem",
            borderRadius: "0.2rem",
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
      </div>
    </div>
  );

  if (calc.status === "planned") {
    return <div aria-disabled="true">{inner}</div>;
  }

  return (
    <Link
      href={`/calcs/${calc.slug}`}
      className="block group are-focus-ring rounded-md"
      style={{ textDecoration: "none" }}
    >
      {inner}
    </Link>
  );
}

// ─── GroupTile — expandable <details> with icon hero ─────────────────────────

function GroupTile({
  label,
  calcs,
  showHint = false,
}: {
  label: string;
  calcs: CalcMeta[];
  showHint?: boolean;
}) {
  const spec = calcs[0]?.spec ?? "";
  const iconKey = calcs[0]?.icon ?? "beam-udl";
  const mat = calcs[0]?.material ?? "Steel";
  const calcType = calcs[0]?.calcType ?? "Connections";
  const accentColor = MATERIAL_COLOR[mat];

  return (
    <details
      className="rounded-md border overflow-hidden"
      style={{
        background: "var(--are-surface)",
        borderColor: "var(--are-border)",
        borderTopWidth: 2,
        borderTopColor: accentColor,
      }}
    >
      <summary
        className="flex flex-row gap-3 items-start p-3.5 cursor-pointer list-none select-none are-details-summary"
        style={{ WebkitAppearance: "none" } as React.CSSProperties}
      >
        {/* Icon */}
        <div
          style={{
            flexShrink: 0,
            width: 48,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CalcIcon icon={iconKey} size={48} />
        </div>

        {/* Summary body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* calcType/material hint in search results */}
          {showHint && (
            <div
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--are-navy-light,#4a6bb5)",
                marginBottom: "0.2rem",
              }}
            >
              {calcType} &middot; {mat}
            </div>
          )}

          {/* Group label + variant count */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.5rem",
              marginBottom: "0.25rem",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--are-navy)",
                lineHeight: 1.2,
              }}
            >
              {label}
            </span>
            <span
              style={{
                flexShrink: 0,
                fontFamily: "var(--font-archivo)",
                fontSize: "0.5rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                background: "#eaf4ee",
                color: "var(--are-ok)",
                borderRadius: "0.2rem",
                padding: "0.1rem 0.35rem",
              }}
            >
              {calcs.length} variants
            </span>
          </div>

          {/* Spec + expand hint */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.5625rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--are-muted)",
              }}
            >
              {spec}
            </span>
            <span
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.5625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--are-navy-mid)",
              }}
            >
              Select &#9660;
            </span>
          </div>
        </div>
      </summary>

      {/* Expanded variant list */}
      <div className="border-t flex flex-col" style={{ borderColor: "var(--are-border)" }}>
        {calcs.map((calc, idx) => (
          <Link
            key={calc.slug}
            href={`/calcs/${calc.slug}`}
            className="flex items-center justify-between px-4 py-3 are-details-summary transition-colors hover:bg-[var(--are-offwhite)]"
            style={
              idx < calcs.length - 1
                ? { borderBottom: "1px solid var(--are-border-soft)" }
                : undefined
            }
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span
                style={{
                  fontFamily: "var(--font-archivo)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--are-navy)",
                  lineHeight: 1.2,
                }}
              >
                {calc.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.8125rem",
                  color: "var(--are-muted)",
                  lineHeight: 1.4,
                }}
              >
                {calc.subtitle}
              </span>
            </div>
            <span
              className="ml-3 shrink-0"
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.5625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--are-navy-mid)",
              }}
            >
              Open &#8594;
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
