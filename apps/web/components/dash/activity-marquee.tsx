// Thin live-activity strip under a page header — same seamless -50%
// wrap as the landing page's Marquee, scaled down to a ticker. Items
// are real facts (latest plays, claims, drops), never invented copy;
// renders nothing when there's nothing to report.
export function ActivityMarquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  // Short lists need repeating so the loop has no visible gap.
  const repeated: string[] = [];
  while (repeated.length < 8) repeated.push(...items);

  return (
    <div className="overflow-hidden rounded-full border-2 border-akosi-fg/15 bg-akosi-accent py-1.5">
      <div className="akosi-marquee flex w-max items-center gap-8 whitespace-nowrap">
        {[0, 1].map((half) => (
          <span
            key={half}
            aria-hidden={half === 1}
            className="flex items-center gap-8 font-display text-xs font-medium tracking-tight text-white uppercase"
          >
            {repeated.map((item, i) => (
              <span key={i} className="flex items-center gap-8">
                {item}
                <span aria-hidden>♪</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
