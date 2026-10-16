import Link from "next/link";
import { CreditCardIcon, PlayIcon, UnlockIcon } from "lucide-react";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { StageLight } from "@/components/admin/stage-light";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: CreditCardIcon,
    title: "Tap",
    description: "Hold the card up to your phone. No app, no account.",
  },
  {
    icon: UnlockIcon,
    title: "Unlock",
    description: "The card opens straight to the artist's release.",
  },
  {
    icon: PlayIcon,
    title: "Listen",
    description: "Stream the track with lyrics and cover art right there.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-10">
        <AkosiWordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
          >
            <Link href="/admin/login">Artist / Admin login</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <StageLight />
          <div className="relative z-10 mx-auto max-w-3xl px-6 py-28 text-center sm:py-36 lg:px-10">
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
              Tap the card.
              <br />
              Hear the music.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-akosi-muted-fg">
              akosi.music turns a physical card into a direct line to an artist&apos;s
              catalog — tap it against your phone and the release opens, no app and no
              account required.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center sm:text-left">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-akosi-accent/10 text-akosi-accent-2 sm:mx-0">
                  <step.icon className="size-5" />
                </div>
                <h2 className="mt-4 font-display text-lg font-medium">
                  <span className="text-akosi-muted-fg">{i + 1}.</span> {step.title}
                </h2>
                <p className="mt-1.5 text-sm text-akosi-muted-fg">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-akosi-fg/10">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:px-10">
            <h2 className="font-display text-2xl font-medium sm:text-3xl">
              Cards are hand-issued for now
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-akosi-muted-fg">
              We&apos;re a small team building this out release by release. If you&apos;re
              an artist curious about a physical card for your music, we&apos;d love to
              hear from you.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-akosi-fg/10 px-6 py-8 lg:px-10">
        <p className="text-center text-xs text-akosi-muted-fg">
          © {new Date().getFullYear()} akosi.music
        </p>
      </footer>
    </div>
  );
}
