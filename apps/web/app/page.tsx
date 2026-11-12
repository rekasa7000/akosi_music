import Link from "next/link";
import { CreditCardIcon, PlayIcon, UnlockIcon } from "lucide-react";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { FoilCard } from "@/components/landing/foil-card";
import { Marquee } from "@/components/landing/marquee";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: CreditCardIcon,
    title: "Tap",
    description: "Hold the card up to your phone. No app, no account.",
    rotate: -2,
  },
  {
    icon: UnlockIcon,
    title: "Unlock",
    description: "The card opens straight to the artist's release.",
    rotate: 1.5,
  },
  {
    icon: PlayIcon,
    title: "Listen",
    description: "Stream the track with lyrics and cover art right there.",
    rotate: -1,
  },
];

const GALLERY: { sweep: "ember" | "plum" | "flare"; rotate: number }[] = [
  { sweep: "plum", rotate: -6 },
  { sweep: "flare", rotate: 4 },
  { sweep: "ember", rotate: -3 },
  { sweep: "flare", rotate: 7 },
  { sweep: "plum", rotate: 3 },
  { sweep: "ember", rotate: -5 },
];

// A FoilCard with the dashboards' hover shimmer: the wrapper carries
// the collage rotation (and overflow/radius), so the shine band sweeps
// the same tilted plane as the card art under it.
function ShimmerFoilCard({
  sweep,
  rotate,
  className,
  delay = 0,
}: {
  sweep: "ember" | "plum" | "flare";
  rotate: number;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn("group akosi-rise relative overflow-hidden rounded-[1.25rem]", className)}
      style={{ transform: `rotate(${rotate}deg)`, animationDelay: `${delay}ms` }}
    >
      <FoilCard sweep={sweep} rotate={0} />
      <div aria-hidden="true" className="akosi-foil-shine pointer-events-none absolute inset-0" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b-2 border-akosi-fg/15 px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
        <AkosiWordmark priority />
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/artists"
            className="text-sm font-medium text-akosi-fg transition-colors hover:text-akosi-accent-2"
          >
            Artists
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-akosi-fg/20 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
            >
              <Link href="/admin/login">Admin login</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* The page's one ambient animated moment. */}
      <Marquee text="Tap to unlock" />

      <main>
        {/* Hero — grain + giant cropped outline word, static; the only
            motion here is the staggered load-in. */}
        <section className="relative overflow-hidden">
          <span
            aria-hidden="true"
            className="akosi-header-word pointer-events-none absolute -right-6 bottom-[-0.3em] text-[clamp(7rem,30vw,20rem)] whitespace-nowrap select-none"
          >
            unlock
          </span>
          <div aria-hidden="true" className="akosi-grain pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 lg:px-10 lg:pt-24 lg:pb-28">
            <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
              <div className="akosi-rise">
                <h1 className="font-display leading-[0.95] font-semibold tracking-tight">
                  <span className="block text-[clamp(2.75rem,9vw,4.5rem)]">Tap the card.</span>
                  <span className="mt-1 block text-[clamp(3.25rem,10vw,5.25rem)] text-akosi-accent-2">
                    Hear the music.
                  </span>
                </h1>
                <p className="mt-7 max-w-md text-lg text-akosi-muted-fg">
                  A physical card that opens straight to an artist&apos;s catalog. Tap it
                  against your phone and the release plays — no app, no account, nothing to
                  set up.
                </p>
                <p className="mt-3 max-w-md text-sm text-akosi-muted-fg">
                  The card is the key: nothing here streams without one in hand.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2!"
                  >
                    <Link href="/admin/login">Manage a catalog</Link>
                  </Button>
                  <p className="text-sm text-akosi-muted-fg">Artists &amp; labels only, for now.</p>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-sm">
                <FoilCard
                  sweep="plum"
                  rotate={6}
                  className="absolute inset-x-6 top-6 opacity-70 blur-[1px]"
                />
                <ShimmerFoilCard sweep="ember" rotate={-4} className="relative" delay={120} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-2 border-akosi-fg/15 bg-akosi-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="akosi-rise relative overflow-hidden rounded-xl border-t-4 border-dashed border-akosi-bg bg-akosi-bg p-6 sm:transform-[rotate(var(--step-tilt))]"
                  style={{ "--step-tilt": `${step.rotate}deg`, animationDelay: `${i * 80}ms` } as React.CSSProperties}
                >
                  <span
                    aria-hidden
                    className="font-display absolute -top-6 -right-3 text-[7rem] leading-none font-bold text-akosi-fg/5"
                  >
                    {i + 1}
                  </span>
                  <div className="relative flex size-11 items-center justify-center rounded-full bg-akosi-accent/15 text-akosi-accent-2">
                    <step.icon className="size-5" />
                  </div>
                  <h2 className="relative mt-5 font-display text-xl font-medium">
                    {step.title}
                  </h2>
                  <p className="relative mt-1.5 text-sm text-akosi-muted-fg">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <h2 className="font-display text-[clamp(1.875rem,6vw,2.5rem)] leading-tight font-semibold">
                No two cards look alike.
              </h2>
              <p className="mt-4 max-w-sm text-akosi-muted-fg">
                Every card is cut and finished by hand in small batches, so the print on
                yours is one of a kind — the NFC tap underneath works exactly the same way
                every time.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-8 py-6 sm:gap-x-6 sm:gap-y-10">
              {GALLERY.map((card, i) => (
                <ShimmerFoilCard
                  key={i}
                  sweep={card.sweep}
                  rotate={card.rotate}
                  delay={i * 70}
                  className={cn("w-full", i % 2 === 1 && "mt-6")}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t-2 border-akosi-fg/15 bg-akosi-surface">
          <div aria-hidden="true" className="akosi-grain pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 sm:py-20 lg:flex-row lg:px-10 lg:text-left">
            {/* The page's single teal highlight: the hand-issued stamp. */}
            <div
              className="flex size-28 shrink-0 flex-col items-center justify-center rounded-full bg-akosi-highlight text-[#241013]"
              style={{ transform: "rotate(-8deg)" }}
            >
              <span className="font-display text-xs font-bold tracking-tight">HAND</span>
              <span className="font-display text-xs font-bold tracking-tight">ISSUED</span>
            </div>
            <div>
              <h2 className="font-display text-2xl font-medium sm:text-3xl">
                We&apos;re a small team, building release by release
              </h2>
              <p className="mt-3 max-w-lg text-sm text-akosi-muted-fg">
                Cards aren&apos;t sold off a shelf yet — we work directly with each artist
                to press a run. If that&apos;s you, get in touch and let&apos;s figure out
                what a card for your music looks like.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-dashed border-akosi-fg/20 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <AkosiWordmark className="opacity-70" />
          <p className="text-xs text-akosi-muted-fg">© {new Date().getFullYear()} akosi.music</p>
        </div>
      </footer>
    </div>
  );
}
