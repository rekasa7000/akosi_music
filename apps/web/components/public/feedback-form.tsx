"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2Icon, StarIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function StarRating({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onMouseEnter={() => setHovered(n)}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <StarIcon
            className={cn("size-7 transition-colors", n <= shown ? "text-akosi-accent-2" : "text-akosi-fg/20")}
            fill={n <= shown ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

export function FeedbackForm({
  type,
  title,
  description,
  messageLabel,
  messagePlaceholder,
  releaseId,
  trackId,
}: {
  type: api.FeedbackType;
  title: string;
  description: string;
  messageLabel: string;
  messagePlaceholder: string;
  releaseId?: string | null;
  trackId?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.submitFeedback({
        type,
        message,
        rating: type === "FEEDBACK" ? (rating ?? undefined) : undefined,
        contactEmail: contactEmail || undefined,
        releaseId: releaseId ?? undefined,
        trackId: trackId ?? undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof api.PublicApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-akosi-fg/10 px-6 py-12 text-center">
        <CheckCircle2Icon className="size-8 text-akosi-accent-2" strokeWidth={1.5} />
        <p className="font-display text-lg font-semibold text-akosi-fg">Thanks — got it.</p>
        <p className="max-w-xs text-sm text-akosi-muted-fg">
          {contactEmail ? "We'll get back to you if we need anything else." : "We'll take it from here."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-akosi-fg">{title}</h1>
      <p className="mt-1.5 text-sm text-akosi-muted-fg">{description}</p>

      <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
        {type === "FEEDBACK" ? (
          <div className="flex flex-col gap-2">
            <Label>How would you rate it? (optional)</Label>
            <StarRating value={rating} onChange={setRating} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-message">{messageLabel}</Label>
          <Textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={messagePlaceholder}
            required
            minLength={1}
            maxLength={2000}
            rows={6}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-email">Email (optional)</Label>
          <Input
            id="feedback-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com — only if you want a reply"
          />
        </div>

        {error ? <p className="text-sm text-akosi-accent-2">{error}</p> : null}

        <Button
          type="submit"
          disabled={busy}
          className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
