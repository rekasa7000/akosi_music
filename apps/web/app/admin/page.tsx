"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/admin-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((user) => setEmail(user.email))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  async function signOut() {
    await api.logout().catch(() => {});
    router.replace("/admin/login");
  }

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b border-akosi-fg/10 px-6 py-4">
        <AkosiWordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl font-medium">Signed in as {email}</h1>
        <p className="mt-3 max-w-md text-sm text-akosi-muted-fg">
          Release and catalog tools aren&apos;t built yet — this is just confirming
          admin authentication works end to end.
        </p>
      </main>
    </div>
  );
}
