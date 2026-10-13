// Recreates the brand mark's mood (warm stage-light glow) in CSS
// rather than an image asset — one deliberate ambient moment behind
// the login card, nothing else on the page moves. Adapts with
// light/dark automatically since it reads the akosi-* custom
// properties, which flip value under .dark.
export function StageLight() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-akosi-bg"
      aria-hidden="true"
    >
      <div
        className="akosi-stage-light absolute -inset-[20%] opacity-90"
        style={{
          background: [
            "radial-gradient(42% 32% at 28% 22%, color-mix(in oklab, var(--color-akosi-accent) 50%, transparent), transparent 70%)",
            "radial-gradient(38% 38% at 76% 68%, color-mix(in oklab, var(--color-akosi-accent-2) 38%, transparent), transparent 70%)",
            "radial-gradient(55% 48% at 50% 102%, color-mix(in oklab, var(--color-akosi-surface) 75%, transparent), transparent 70%)",
          ].join(", "),
        }}
      />
      <div className="absolute inset-0 bg-akosi-bg/35" />
    </div>
  );
}
