export function Marquee({ text }: { text: string }) {
  return (
    <div className="overflow-hidden border-y-2 border-akosi-fg/15 bg-akosi-accent py-3">
      <div className="akosi-marquee flex w-max items-center gap-10 whitespace-nowrap">
        {[0, 1].map((i) => (
          <span
            key={i}
            aria-hidden={i === 1}
            className="flex items-center gap-10 font-display text-sm font-medium tracking-tight text-white uppercase"
          >
            {Array.from({ length: 8 }).map((_, j) => (
              <span key={j} className="flex items-center gap-10">
                {text}
                <span aria-hidden>♪</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
