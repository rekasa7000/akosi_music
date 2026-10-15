"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreditCardIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AkosiWordmark } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/artists", label: "Artists", icon: UsersIcon },
  { href: "/admin/cards", label: "Cards", icon: CreditCardIcon },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  async function signOut() {
    await api.logout().catch(() => {});
    router.replace("/admin/login");
  }

  if (!authed) {
    return null;
  }

  return (
    <div className="flex min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-akosi-fg/10 bg-akosi-surface/50 px-4 py-6">
        <div className="mb-8 px-2">
          <AkosiWordmark />
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-akosi-accent text-white"
                    : "text-akosi-muted-fg hover:bg-akosi-fg/5 hover:text-akosi-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between px-2 pt-4">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="text-akosi-muted-fg hover:text-akosi-fg"
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
