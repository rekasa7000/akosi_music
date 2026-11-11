"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon, LayoutDashboardIcon, WalletCardsIcon } from "lucide-react";
import * as api from "@/lib/artist-api";
import { DashShell, type DashNavItem } from "@/components/dash/dash-shell";

const NAV_ITEMS: DashNavItem[] = [
  { href: "/artist", label: "Home", icon: LayoutDashboardIcon, exact: true },
  { href: "/artist/cards", label: "My cards", icon: WalletCardsIcon },
  { href: "/artist/fans", label: "Fans", icon: HeartIcon },
];

export function ArtistShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<api.Me | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => router.replace("/artist/login"));
  }, [router]);

  async function signOut() {
    await api.logout().catch(() => {});
    router.replace("/artist/login");
  }

  if (!me) {
    return null;
  }

  return (
    <DashShell
      navItems={NAV_ITEMS}
      homeHref="/artist"
      accountLabel={me.artistName}
      accountSub={me.email}
      onSignOut={signOut}
    >
      {children}
    </DashShell>
  );
}
