"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { FeedbackForm } from "@/components/public/feedback-form";

function ReportIssueForm() {
  const searchParams = useSearchParams();

  return (
    <FeedbackForm
      type="ERROR"
      title="Report an issue"
      description="Something not working right? Let us know what happened."
      messageLabel="What went wrong?"
      messagePlaceholder="e.g. the track won't play, a code didn't unlock, the page looks broken…"
      releaseId={searchParams.get("releaseId")}
      trackId={searchParams.get("trackId")}
    />
  );
}

export default function ReportIssuePage() {
  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b-2 border-akosi-fg/15 px-6 py-5 lg:px-10">
        <Link href="/">
          <AkosiWordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-lg px-6 py-12 lg:px-10">
        <Suspense fallback={null}>
          <ReportIssueForm />
        </Suspense>
      </main>
    </div>
  );
}
