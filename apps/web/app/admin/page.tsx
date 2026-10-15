"use client";

import { useEffect, useState } from "react";
import { CreditCardIcon, DiscIcon, Music2Icon, PlayIcon, UsersIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
import { NewReleaseDialog } from "@/components/admin/catalog/new-release-dialog";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-akosi-fg/10 bg-akosi-surface p-5">
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-akosi-accent/10 text-akosi-accent-2">
        <Icon className="size-4.5" />
      </div>
      <p className="font-display text-3xl font-semibold text-akosi-fg">{value}</p>
      <p className="mt-0.5 text-sm text-akosi-muted-fg">{label}</p>
      {sub ? <p className="mt-2 text-xs text-akosi-muted-fg">{sub}</p> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<api.Stats | null>(null);
  const [artists, setArtists] = useState<api.Artist[] | null>(null);

  useEffect(() => {
    api.getStats().then(setStats);
    api.listArtists().then(setArtists);
  }, []);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">An overview of your catalog.</p>
          </div>
          <div className="flex gap-2">
            {artists ? (
              <NewArtistDialog
                onCreated={(a) => {
                  setArtists([a, ...artists]);
                  api.getStats().then(setStats);
                }}
              />
            ) : null}
            {artists ? (
              <NewReleaseDialog artists={artists} onCreated={() => api.getStats().then(setStats)} />
            ) : null}
          </div>
        </div>

        {stats === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={UsersIcon} label="Artists" value={stats.artistCount} />
            <StatCard icon={DiscIcon} label="Releases" value={stats.releaseCount} />
            <StatCard icon={Music2Icon} label="Tracks" value={stats.trackCount} />
            <StatCard icon={PlayIcon} label="Total plays" value={stats.totalPlays} />
            <StatCard
              icon={CreditCardIcon}
              label="Cards"
              value={stats.cardCount}
              sub={`${stats.cardsByStatus.UNCLAIMED + stats.cardsByStatus.CLAIMED} active · ${stats.cardsByStatus.REVOKED} revoked`}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
