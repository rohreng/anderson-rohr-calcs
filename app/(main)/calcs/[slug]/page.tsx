import { notFound } from "next/navigation";
import Header from "../../../components/Header";
import { CALCS } from "../../../lib/calcs";

// ─── Static params — tells Next.js which slugs to pre-render ──────────────────

export function generateStaticParams() {
  return CALCS.filter((c) => c.status !== "planned").map((c) => ({
    slug: c.slug,
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CalcPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const calc = CALCS.find((c) => c.slug === slug);

  if (!calc || calc.status === "planned") {
    notFound();
  }

  return (
    <>
      <Header
        title={calc.label}
        breadcrumb={[{ label: calc.category }, { label: calc.label }]}
      />

      {/* iframe pinned to fill the exact remaining viewport */}
      <iframe
        src={calc.htmlFile}
        title={calc.label}
        style={{
          position: "fixed",
          top: "var(--header-height)",
          left: "var(--sidebar-width)",
          right: 0,
          bottom: 0,
          width: "calc(100vw - var(--sidebar-width))",
          height: "calc(100dvh - var(--header-height))",
          border: "none",
          display: "block",
        }}
      />
    </>
  );
}
