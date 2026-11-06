"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/artist-api";
import { AuthShell, AuthHeading } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "password-setup"; email: string; currentPassword: string };

const brandButton =
  "w-full bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-akosi-accent-2">
      {message}
    </p>
  );
}

export function ArtistLoginFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Skip the login form entirely if a session already exists.
  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/artist"))
      .catch(() => setStage({ kind: "login" }));
  }, [router]);

  if (stage.kind === "loading") {
    return (
      <AuthShell>
        <p className="text-center text-sm text-akosi-muted-fg">Checking session…</p>
      </AuthShell>
    );
  }

  if (stage.kind === "login") {
    return (
      <AuthShell>
        <AuthHeading title="Sign in" description="Artist portal access." />
        <form
          className="space-y-4"
          onSubmit={async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const email = String(form.get("email"));
            const password = String(form.get("password"));
            setError(null);
            setBusy(true);
            try {
              const res = await api.login(email, password);
              if (res.step === "PASSWORD_SETUP") {
                setStage({ kind: "password-setup", email, currentPassword: password });
              } else {
                router.replace("/artist");
              }
            } catch (err) {
              setError(err instanceof api.ArtistApiError ? err.message : "Something went wrong.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy} className={brandButton}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  // password-setup — reached on first login, still on the admin-issued
  // temp password. email + currentPassword already came from the login
  // submit, so this step doesn't ask the artist to retype anything.
  return (
    <AuthShell>
      <AuthHeading
        title="Set a password"
        description="Replace the temporary password from your invite with one only you know."
      />
      <form
        className="space-y-4"
        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const newPassword = String(new FormData(e.currentTarget).get("password"));
          setError(null);
          setBusy(true);
          try {
            await api.setupPassword(stage.email, stage.currentPassword, newPassword);
            router.replace("/artist");
          } catch (err) {
            setError(err instanceof api.ArtistApiError ? err.message : "Something went wrong.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          {/* Hidden username anchor — without an explicit username-typed
              field on this form, Chromium's autofill sometimes guesses the
              adjacent password input should be pre-filled with whatever
              text it last saw (the email from the previous login step).
              A properly-attributed (if invisible) username field gives it
              a real anchor instead. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={stage.email}
            readOnly
            hidden
          />
          <Input
            id="new-password"
            name="password"
            type="password"
            minLength={12}
            required
            autoFocus
            autoComplete="new-password"
          />
          <p className="text-xs text-akosi-muted-fg">At least 12 characters.</p>
        </div>
        <FieldError message={error} />
        <Button type="submit" disabled={busy} className={brandButton}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthShell>
  );
}
