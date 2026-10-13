"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/admin-api";
import { AuthShell, AuthHeading, SetupProgress } from "./auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Stage =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "set-email"; token: string }
  | { kind: "verify-email"; token: string; email: string }
  | { kind: "password-setup"; token: string }
  | { kind: "totp-enroll"; token: string; qr: string; key: string }
  | { kind: "select-method"; token: string; methods: string[] }
  | { kind: "enter-code"; token: string; method: "EMAIL" | "TOTP" };

const brandButton =
  "w-full bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60";

function setupStepIndex(kind: Stage["kind"]): number {
  switch (kind) {
    case "set-email":
      return 0;
    case "verify-email":
      return 1;
    case "password-setup":
      return 2;
    case "totp-enroll":
      return 3;
    default:
      return -1;
  }
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-akosi-accent-2">
      {message}
    </p>
  );
}

function OtpField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange} autoFocus>
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

export function AdminLoginFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Shared by every code-entry stage (verify-email, totp-enroll,
  // enter-code) — they're never shown at the same time, so one field
  // is simpler than threading separate state through each branch.
  // Hoisted here, not inside the conditional branches below, because
  // hooks can't be called conditionally.
  const [code, setCode] = useState("");

  // Skip the login form entirely if a session already exists.
  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/admin"))
      .catch(() => setStage({ kind: "login" }));
  }, [router]);

  function applyResponse(res: api.ChallengeResponse, email?: string) {
    setCode("");
    switch (res.step) {
      case "SET_EMAIL":
        setStage({ kind: "set-email", token: res.challengeToken! });
        break;
      case "EMAIL_VERIFICATION":
        setStage({
          kind: "verify-email",
          token: res.challengeToken!,
          email: email ?? "",
        });
        break;
      case "PASSWORD_SETUP":
        setStage({ kind: "password-setup", token: res.challengeToken! });
        break;
      case "TOTP_ENROLLMENT":
        setStage({
          kind: "totp-enroll",
          token: res.challengeToken!,
          qr: res.qrCodeDataUrl!,
          key: res.manualEntryKey!,
        });
        break;
      case "SELECT_MFA_METHOD":
        setStage({
          kind: "select-method",
          token: res.challengeToken!,
          methods: res.availableMethods ?? [],
        });
        break;
      case "ENTER_CODE":
        // handled by the caller, which already knows the chosen method
        break;
      case "DONE":
        router.replace("/admin");
        break;
    }
  }

  async function run(action: () => Promise<api.ChallengeResponse>, email?: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await action();
      applyResponse(res, email);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

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
        <AuthHeading title="Sign in" description="Admin access only." />
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const email = String(form.get("email"));
            const password = String(form.get("password"));
            run(() => api.login(email, password), email);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" required autoFocus autoComplete="username" />
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

  if (stage.kind === "set-email") {
    return (
      <AuthShell>
        <SetupProgress index={setupStepIndex(stage.kind)} />
        <AuthHeading
          title="Add your email"
          description="We'll send a code to confirm it."
        />
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get("email"));
            run(() => api.setupEmail(stage.token, email), email);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy} className={brandButton}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (stage.kind === "verify-email") {
    return (
      <AuthShell>
        <SetupProgress index={setupStepIndex(stage.kind)} />
        <AuthHeading
          title="Check your email"
          description={
            stage.email
              ? `Enter the 6-digit code we sent to ${stage.email}.`
              : "Enter the 6-digit code we sent you."
          }
        />
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            run(() => api.verifyEmail(stage.token, code));
          }}
        >
          <OtpField value={code} onChange={setCode} />
          <FieldError message={error} />
          <Button type="submit" disabled={busy || code.length < 6} className={brandButton}>
            {busy ? "Confirming…" : "Confirm"}
          </Button>
          <button
            type="button"
            className="block w-full text-center text-sm text-akosi-muted-fg underline-offset-4 hover:text-akosi-fg hover:underline"
            onClick={() => setStage({ kind: "set-email", token: stage.token })}
          >
            Use a different email
          </button>
        </form>
      </AuthShell>
    );
  }

  if (stage.kind === "password-setup") {
    return (
      <AuthShell>
        <SetupProgress index={setupStepIndex(stage.kind)} />
        <AuthHeading
          title="Set a password"
          description="Replace the shared setup password with one only you know."
        />
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const password = String(form.get("password"));
            const confirm = String(form.get("confirm"));
            if (password !== confirm) {
              setError("Those passwords don't match.");
              return;
            }
            run(() => api.setupPassword(stage.token, password));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={12}
              required
              autoFocus
              autoComplete="new-password"
            />
            <p className="text-xs text-akosi-muted-fg">At least 12 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy} className={brandButton}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (stage.kind === "totp-enroll") {
    return (
      <AuthShell>
        <SetupProgress index={setupStepIndex(stage.kind)} />
        <AuthHeading
          title="Set up an authenticator"
          description="Scan this with Google Authenticator or a similar app."
        />
        <div className="mb-5 flex justify-center">
          <img
            src={stage.qr}
            alt="Authenticator QR code"
            className="size-40 rounded-sm border border-black/10 bg-white p-2"
          />
        </div>
        <p className="mb-5 text-center text-xs text-akosi-muted-fg">
          Can&apos;t scan? Enter this key manually:{" "}
          <code className="break-all text-akosi-fg">{stage.key}</code>
        </p>
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            run(() => api.confirmTotp(stage.token, code));
          }}
        >
          <div className="flex justify-center">
            <OtpField value={code} onChange={setCode} />
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={busy || code.length < 6} className={brandButton}>
            {busy ? "Confirming…" : "Confirm"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (stage.kind === "select-method") {
    return (
      <AuthShell>
        <AuthHeading title="Verify it's you" description="Choose how to get a code." />
        <div className="space-y-3">
          {stage.methods.includes("TOTP") && (
            <Button
              className="w-full justify-center border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.selectLoginMethod(stage.token, "TOTP");
                  setStage({ kind: "enter-code", token: stage.token, method: "TOTP" });
                  return { step: "ENTER_CODE" };
                })
              }
            >
              Authenticator app
            </Button>
          )}
          {stage.methods.includes("EMAIL") && (
            <Button
              className="w-full justify-center border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.selectLoginMethod(stage.token, "EMAIL");
                  setStage({ kind: "enter-code", token: stage.token, method: "EMAIL" });
                  return { step: "ENTER_CODE" };
                })
              }
            >
              Email
            </Button>
          )}
        </div>
        <FieldError message={error} />
      </AuthShell>
    );
  }

  // enter-code
  return (
    <AuthShell>
      <AuthHeading
        title="Enter the code"
        description={
          stage.method === "TOTP"
            ? "From your authenticator app."
            : "We emailed you a 6-digit code."
        }
      />
      <form
        className="space-y-4"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          run(() => api.verifyLogin(stage.token, code));
        }}
      >
        <div className="flex justify-center">
          <OtpField value={code} onChange={setCode} />
        </div>
        <FieldError message={error} />
        <Button type="submit" disabled={busy || code.length < 6} className={brandButton}>
          {busy ? "Confirming…" : "Confirm"}
        </Button>
      </form>
    </AuthShell>
  );
}
