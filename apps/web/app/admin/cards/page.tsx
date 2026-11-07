"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CreditCardIcon,
  Loader2Icon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { StageLight } from "@/components/admin/stage-light";
import { StatTile } from "@/components/admin/stat-tile";
import { NewCardDialog } from "@/components/admin/catalog/new-card-dialog";
import { BulkCreateCardsDialog } from "@/components/admin/catalog/bulk-create-cards-dialog";
import { MarkCardSoldDialog } from "@/components/admin/catalog/mark-card-sold-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";
import { cn } from "@/lib/utils";

const GROUP_BY_LABELS: Record<api.CardGroupBy, string> = {
  artist: "Artist",
  release: "Album",
  track: "Track",
  status: "Status",
  edition: "Edition",
};

const PAGE_SIZE = 50;

type GroupState = {
  cards: api.Card[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
};

function CardRow({
  card,
  idx,
  busy,
  onToggleRevoke,
  onSoldUpdated,
}: {
  card: api.Card;
  idx: number;
  busy: boolean;
  onToggleRevoke: (card: api.Card) => void;
  onSoldUpdated: (card: api.Card) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-2xl border-2 bg-akosi-surface py-4 pr-5 pl-6",
        card.status === "REVOKED" ? "border-akosi-fg/15" : "border-akosi-accent-2/30",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          card.status === "REVOKED" ? "bg-akosi-fg/20" : "bg-akosi-accent-2",
        )}
      />
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          card.status === "REVOKED" ? "bg-akosi-fg/10 text-akosi-muted-fg" : "text-white",
        )}
        style={card.status === "REVOKED" ? undefined : { background: FOIL_SWEEPS[idx % FOIL_SWEEPS.length] }}
      >
        <CreditCardIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-base font-semibold">{card.uid}</p>
        <p className="truncate text-sm text-akosi-muted-fg">
          {card.trackTitle} — {card.releaseTitle} ({card.artistName})
        </p>
        {card.ownerEmail ? (
          <p className="truncate text-xs text-akosi-muted-fg">Sold to {card.ownerEmail}</p>
        ) : null}
      </div>
      {card.editionLabel ? (
        <Badge variant="outline" className="shrink-0 border-akosi-fg/15 text-akosi-muted-fg">
          {card.editionLabel}
        </Badge>
      ) : null}
      <span className="shrink-0 text-sm tabular-nums text-akosi-muted-fg">
        {card.playCount} play{card.playCount === 1 ? "" : "s"}
      </span>
      <Badge
        className={cn(
          "shrink-0 border-none",
          card.status === "REVOKED"
            ? "bg-akosi-fg/10 text-akosi-muted-fg"
            : "bg-akosi-accent-2/15 text-akosi-accent-2",
        )}
      >
        {card.status}
      </Badge>
      {card.status !== "REVOKED" ? <MarkCardSoldDialog card={card} onUpdated={onSoldUpdated} /> : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        className="shrink-0 text-akosi-muted-fg hover:text-akosi-fg"
        onClick={() => onToggleRevoke(card)}
      >
        {card.status === "REVOKED" ? "Restore" : "Revoke"}
      </Button>
    </div>
  );
}

export default function CardsPage() {
  const [stats, setStats] = useState<api.CardStats | null>(null);
  const [tracks, setTracks] = useState<api.TrackPickerEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<api.CardGroupBy>("artist");

  const [groups, setGroups] = useState<api.CardGroupSummary[] | null>(null);
  const [expanded, setExpanded] = useState<Map<string, GroupState>>(new Map());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getCardStats().then(setStats);
    api.listAllTracks().then(setTracks);
  }, []);

  // Debounce the search box — grouping is a live backend query, not a
  // client-side filter, so firing one per keystroke would hammer the
  // API as the admin types.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    api.listCardGroups({ groupBy, search: search || undefined }).then((result) => {
      if (cancelled) return;
      setGroups(result);
      setExpanded(new Map());
    });
    return () => {
      cancelled = true;
    };
  }, [groupBy, search]);

  async function fetchGroupPage(key: string, cursor?: string) {
    return api.listCards({ groupBy, groupKey: key, search: search || undefined, cursor, limit: PAGE_SIZE });
  }

  async function toggleGroup(key: string) {
    setExpanded((prev) => {
      if (prev.has(key)) {
        const next = new Map(prev);
        next.delete(key);
        return next;
      }
      const next = new Map(prev);
      next.set(key, { cards: [], nextCursor: null, loading: true, loadingMore: false });
      return next;
    });

    if (expanded.has(key)) return;

    const page = await fetchGroupPage(key);
    setExpanded((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.set(key, { cards: page.cards, nextCursor: page.nextCursor, loading: false, loadingMore: false });
      return next;
    });
  }

  async function loadMore(key: string) {
    const entry = expanded.get(key);
    if (!entry || !entry.nextCursor || entry.loadingMore) return;

    setExpanded((prev) => {
      const next = new Map(prev);
      next.set(key, { ...entry, loadingMore: true });
      return next;
    });

    const page = await fetchGroupPage(key, entry.nextCursor);
    setExpanded((prev) => {
      const current = prev.get(key);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(key, {
        cards: [...current.cards, ...page.cards],
        nextCursor: page.nextCursor,
        loading: false,
        loadingMore: false,
      });
      return next;
    });
  }

  async function expandAll() {
    if (!groups) return;
    for (const group of groups) {
      if (!expanded.has(group.key)) {
        await toggleGroup(group.key);
      }
    }
  }

  function collapseAll() {
    setExpanded(new Map());
  }

  // After creating card(s), counts/groups may have changed and any
  // currently-open group's cached page is stale — cheap to just
  // refetch stats, the group summary, and every open group's first
  // page rather than try to patch state in place.
  async function refreshAfterCreate() {
    api.getCardStats().then(setStats);
    const freshGroups = await api.listCardGroups({ groupBy, search: search || undefined });
    setGroups(freshGroups);

    const openKeys = [...expanded.keys()];
    for (const key of openKeys) {
      const page = await fetchGroupPage(key);
      setExpanded((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, { cards: page.cards, nextCursor: page.nextCursor, loading: false, loadingMore: false });
        return next;
      });
    }
  }

  async function toggleRevoke(card: api.Card) {
    setBusyId(card.id);
    try {
      const updated = await api.updateCard(card.id, {
        status: card.status === "REVOKED" ? "UNCLAIMED" : "REVOKED",
      });
      setExpanded((prev) => {
        const next = new Map(prev);
        for (const [key, state] of next) {
          next.set(key, {
            ...state,
            cards: state.cards.map((c) => (c.id === updated.id ? updated : c)),
          });
        }
        return next;
      });
      api.getCardStats().then(setStats);
    } finally {
      setBusyId(null);
    }
  }

  // MarkCardSoldDialog already made the API call and has its own busy
  // state — this just folds the result into the page the same way
  // toggleRevoke does.
  function handleSoldUpdated(updated: api.Card) {
    setExpanded((prev) => {
      const next = new Map(prev);
      for (const [key, state] of next) {
        next.set(key, {
          ...state,
          cards: state.cards.map((c) => (c.id === updated.id ? updated : c)),
        });
      }
      return next;
    });
    api.getCardStats().then(setStats);
  }

  const totalShown = useMemo(() => groups?.reduce((sum, g) => sum + g.count, 0) ?? 0, [groups]);

  return (
    <AdminShell>
      <div className="px-8 py-10">
        {/* The one ambient moment on this page — same confined stage-light
            glow as the dashboard and artist roster heroes. */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border-2 border-akosi-fg/15">
          <StageLight />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-14 font-display text-[9rem] leading-none font-bold text-akosi-fg/5 select-none"
          >
            #
          </span>
          <div className="relative flex flex-wrap items-center justify-between gap-4 px-8 py-10">
            <div>
              <p className="font-display text-xs font-semibold tracking-[0.2em] text-akosi-accent-2 uppercase">
                akosi admin
              </p>
              <h1 className="mt-1 font-display text-4xl font-bold lowercase leading-[0.95]">Cards</h1>
              <p className="mt-2 text-sm text-akosi-muted-fg">
                Manually provisioned cards and the tracks they unlock.
              </p>
            </div>
            <div className="flex gap-2">
              {tracks ? <BulkCreateCardsDialog tracks={tracks} onCreated={refreshAfterCreate} /> : null}
              {tracks ? <NewCardDialog tracks={tracks} onCreated={refreshAfterCreate} /> : null}
            </div>
          </div>
        </div>

        {stats ? (
          <div className="mb-8 grid grid-cols-3 gap-4">
            <StatTile icon={CreditCardIcon} label="Total cards" value={stats.total} accent="accent" />
            <StatTile icon={CheckCircle2Icon} label="Active" value={stats.active} accent="accent-2" />
            <StatTile icon={XCircleIcon} label="Revoked" value={stats.revoked} accent="accent" />
          </div>
        ) : null}

        {stats !== null && stats.total === 0 ? (
          <p className="text-sm text-akosi-muted-fg">
            No cards yet — provision one to gate a track.
          </p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-akosi-muted-fg" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search code, track, release, artist…"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-akosi-muted-fg">Group by</span>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as api.CardGroupBy)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GROUP_BY_LABELS) as api.CardGroupBy[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {GROUP_BY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex gap-2 text-sm">
                <button type="button" onClick={expandAll} className="text-akosi-accent-2 hover:underline">
                  Expand all
                </button>
                <span className="text-akosi-fg/20">·</span>
                <button type="button" onClick={collapseAll} className="text-akosi-accent-2 hover:underline">
                  Collapse all
                </button>
              </div>
            </div>

            {groups === null ? (
              <p className="text-sm text-akosi-muted-fg">Loading…</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-akosi-muted-fg">No cards match &quot;{search}&quot;.</p>
            ) : (
              <>
                {search ? (
                  <p className="mb-3 text-xs text-akosi-muted-fg">
                    {totalShown} card{totalShown === 1 ? "" : "s"} across {groups.length} group
                    {groups.length === 1 ? "" : "s"} match &quot;{search}&quot;.
                  </p>
                ) : null}
                <div className="space-y-3">
                  {groups.map((group) => {
                    const state = expanded.get(group.key);
                    const isOpen = state !== undefined;
                    return (
                      <div key={group.key} className="overflow-hidden rounded-2xl border-2 border-akosi-fg/15">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="flex w-full items-center gap-3 bg-akosi-surface px-5 py-3.5 text-left transition-colors hover:bg-akosi-fg/5"
                        >
                          {isOpen ? (
                            <ChevronDownIcon className="size-4 shrink-0 text-akosi-muted-fg" />
                          ) : (
                            <ChevronRightIcon className="size-4 shrink-0 text-akosi-muted-fg" />
                          )}
                          <p className="min-w-0 flex-1 truncate font-display text-base font-semibold">
                            {group.label}
                          </p>
                          <span className="shrink-0 text-sm text-akosi-muted-fg">
                            {group.activeCount}/{group.count} active
                          </span>
                          <Badge className="shrink-0 border-none bg-akosi-accent/15 text-akosi-accent-2">
                            {group.count}
                          </Badge>
                        </button>
                        {isOpen ? (
                          <div className="space-y-3 bg-akosi-bg p-3">
                            {state.loading ? (
                              <p className="px-2 py-4 text-sm text-akosi-muted-fg">Loading…</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                  {state.cards.map((card, idx) => (
                                    <CardRow
                                      key={card.id}
                                      card={card}
                                      idx={idx}
                                      busy={busyId === card.id}
                                      onToggleRevoke={toggleRevoke}
                                      onSoldUpdated={handleSoldUpdated}
                                    />
                                  ))}
                                </div>
                                {state.nextCursor ? (
                                  <div className="flex justify-center pt-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={state.loadingMore}
                                      onClick={() => loadMore(group.key)}
                                      className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
                                    >
                                      {state.loadingMore ? (
                                        <Loader2Icon className="size-4 animate-spin" />
                                      ) : null}
                                      Load {Math.min(PAGE_SIZE, group.count - state.cards.length)} more
                                    </Button>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
