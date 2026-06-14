export default function Header({
  title,
  breadcrumb,
  specBadges = true,
}: {
  title: string;
  breadcrumb?: { label: string }[];
  specBadges?: boolean;
}) {
  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-7 border-b"
      style={{
        left: "var(--sidebar-width)",
        height: "var(--header-height)",
        background: "var(--are-surface)",
        borderColor: "var(--are-border)",
      }}
    >
      {/* Left */}
      <div className="flex flex-col justify-center gap-0.5 leading-none">
        {breadcrumb && breadcrumb.length > 0 && (
          <p
            className="uppercase tracking-widest text-[9px] font-semibold"
            style={{ color: "var(--are-muted)", fontFamily: "var(--font-archivo)" }}
          >
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {crumb.label}
                {i < breadcrumb.length - 1 && <span className="mx-1.5 opacity-40">›</span>}
              </span>
            ))}
          </p>
        )}
        {/* h1 raised from text-sm (14px) to text-base (16px) — was too small for the page title role */}
        <h1
          className="text-base font-semibold tracking-tight"
          style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
        >
          {title}
        </h1>
      </div>

      {/* Right — spec badges; hidden on hub page where they live in the brand column */}
      {specBadges && (
        <div className="flex items-center gap-2">
          {["AISC 360-22", "ACI 318-19"].map((spec) => (
            <span
              key={spec}
              className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded"
              style={{
                fontFamily: "var(--font-archivo)",
                background: "var(--are-offwhite)",
                color: "var(--are-muted)",
                border: "1px solid var(--are-border)",
              }}
            >
              {spec}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
