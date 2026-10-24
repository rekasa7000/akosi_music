"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2Icon, ClockIcon, KeyRoundIcon, MailIcon, ShieldAlertIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function SettingsPage() {
  const [me, setMe] = useState<api.Me | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.me().then(setMe);
  }, []);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      reset();
      setSuccess(true);
      setMe((prev) => (prev ? { ...prev, passwordSetAt: new Date().toISOString() } : prev));
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="px-8 py-10">
        <div className="mb-8 border-b-2 border-akosi-fg/10 pb-8">
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-sm text-akosi-muted-fg">Manage your admin account.</p>
        </div>

        {!me ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <div className="max-w-xl space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-5">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-akosi-accent" />
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-akosi-accent/15 text-akosi-accent">
                  <MailIcon className="size-5" />
                </div>
                <p className="truncate font-display text-lg font-bold text-akosi-fg">{me.email}</p>
                <p className="mt-0.5 text-sm font-medium text-akosi-muted-fg">Admin email</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-5">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-akosi-accent-2" />
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-akosi-accent-2/15 text-akosi-accent-2">
                  <ClockIcon className="size-5" />
                </div>
                <p className="font-display text-lg font-bold text-akosi-fg">{formatDate(me.passwordSetAt)}</p>
                <p className="mt-0.5 text-sm font-medium text-akosi-muted-fg">Password last changed</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface">
              <div className="flex items-center gap-3 border-b-2 border-akosi-fg/10 px-6 py-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-akosi-accent/15 text-akosi-accent">
                  <KeyRoundIcon className="size-4.5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">Change password</h2>
                  <p className="text-sm text-akosi-muted-fg">
                    Requires your current password — an open session alone isn&apos;t enough.
                  </p>
                </div>
              </div>

              <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="text-xs text-akosi-muted-fg">At least 12 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-akosi-accent-2/30 bg-akosi-accent-2/10 px-4 py-3 text-sm text-akosi-accent-2"
                  >
                    <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                    Password updated.
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={busy}
                    className={cn("bg-akosi-accent! text-white! hover:bg-akosi-accent-2!", "disabled:opacity-60")}
                  >
                    {busy ? "Updating…" : "Update password"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
