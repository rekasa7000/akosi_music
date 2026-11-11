"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon, LayoutDashboardIcon, SettingsIcon, UsersIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { DashShell, type DashNavItem } from "@/components/dash/dash-shell";

const NAV_ITEMS: DashNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/artists", label: "Artists", icon: UsersIcon },
  { href: "/admin/cards", label: "Cards", icon: CreditCardIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminShell({ children }: { children: ReactNode }) {
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
    <DashShell
      navItems={NAV_ITEMS}
      homeHref="/admin"
      accountLabel={email}
      accountHref="/admin/settings"
      onSignOut={signOut}
    >
      {children}
    </DashShell>
  );
}
