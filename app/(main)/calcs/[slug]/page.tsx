import { notFound } from "next/navigation";
import Header from "../../../components/Header";
import { CALCS } from "../../../lib/calcs";

// Static params — tells Next.js which slugs to pre-render.

export function generateStaticParams() {
  return CALCS.filter((c) => c.status !== "planned").map((c) => ({
    slug: c.slug,
  }));
}

// Page

export default async function CalcPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { slug } = await params;
  const calc = CALCS.find((c) => c.slug === slug);

  if (!calc || calc.status === "planned") {
    notFound();
  }

  // Forward a saved-calc ?id= onto the iframe so the calc HTML (via
  // are-state-loader.js) can hydrate from /api/calc/[id]. Spec section 5.3.
  const { id } = await searchParams;
  const calcId = Array.isArray(id) ? id[0] : id;
  const iframeSrc =
    calcId && /^[0-9a-fA-F-]{36}$/.test(calcId)
      ? `${calc.htmlFile}?id=${encodeURIComponent(calcId)}`
      : calc.htmlFile;

  return (
    <>
      <Header
        title={calc.label}
        breadcrumb={[{ label: calc.category }, { label: calc.label }]}
      />

      {/* iframe pinned to fill the exact remaining viewport */}
      <iframe
        src={iframeSrc}
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
