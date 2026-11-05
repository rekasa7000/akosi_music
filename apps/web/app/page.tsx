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
    sweep: "ember" as const,
    rotate: -2,
  },
  {
    icon: UnlockIcon,
    title: "Unlock",
    description: "The card opens straight to the artist's release.",
    sweep: "plum" as const,
    rotate: 1.5,
  },
  {
    icon: PlayIcon,
    title: "Listen",
    description: "Stream the track with lyrics and cover art right there.",
    sweep: "flare" as const,
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

export default function HomePage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b-2 border-akosi-fg/15 px-6 py-5 lg:px-10">
        <AkosiWordmark priority />
        <div className="flex items-center gap-5">
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

      <Marquee text="Tap to unlock" />

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 lg:px-10 lg:pt-24">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="font-display leading-[0.95] font-semibold tracking-tight">
                <span className="block text-5xl sm:text-6xl">Tap the card.</span>
                <span className="mt-1 block text-6xl text-akosi-accent-2 sm:text-7xl">
                  Hear the music.
                </span>
              </h1>
              <p className="mt-7 max-w-md text-lg text-akosi-muted-fg">
                A physical card that opens straight to an artist&apos;s catalog. Tap it
                against your phone and the release plays — no app, no account, nothing to
                set up.
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
              <FoilCard sweep="ember" rotate={-4} className="relative" />
            </div>
          </div>
        </section>

        <section className="border-t-2 border-akosi-fg/15 bg-akosi-surface">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="relative overflow-hidden rounded-xl border-t-4 border-dashed border-akosi-bg bg-akosi-bg p-6"
                  style={{ transform: `rotate(${step.rotate}deg)` }}
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

        <section className="mx-auto max-w-6xl px-6 py-24 lg:px-10">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                No two cards look alike.
              </h2>
              <p className="mt-4 max-w-sm text-akosi-muted-fg">
                Every card is cut and finished by hand in small batches, so the print on
                yours is one of a kind — the NFC tap underneath works exactly the same way
                every time.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-10 py-6">
              {GALLERY.map((card, i) => (
                <FoilCard
                  key={i}
                  sweep={card.sweep}
                  rotate={card.rotate}
                  className={cn("w-full", i % 2 === 1 && "mt-6")}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="border-t-2 border-akosi-fg/15 bg-akosi-surface">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-20 text-center lg:flex-row lg:text-left lg:px-10">
            <div
              className="flex size-28 shrink-0 flex-col items-center justify-center rounded-full border-2 border-dashed border-akosi-accent-2/50 text-akosi-accent-2"
              style={{ transform: "rotate(-8deg)" }}
            >
              <span className="font-display text-xs font-semibold tracking-tight">
                HAND
              </span>
              <span className="font-display text-xs font-semibold tracking-tight">
                ISSUED
              </span>
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

      <footer className="border-t-2 border-dashed border-akosi-fg/20 px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <AkosiWordmark className="opacity-70" />
          <p className="text-xs text-akosi-muted-fg">© {new Date().getFullYear()} akosi.music</p>
        </div>
      </footer>
    </div>
  );
}
