"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { FeedbackForm } from "@/components/public/feedback-form";

function FeedbackPageForm() {
  const searchParams = useSearchParams();

  return (
    <FeedbackForm
      type="FEEDBACK"
      title="Share your feedback"
      description="Tell us what you think — what you liked, what could be better."
      messageLabel="What's on your mind?"
      messagePlaceholder="Thoughts, ideas, anything you want us to know…"
      releaseId={searchParams.get("releaseId")}
      trackId={searchParams.get("trackId")}
    />
  );
}

export default function FeedbackPage() {
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
          <FeedbackPageForm />
        </Suspense>
      </main>
    </div>
  );
}
