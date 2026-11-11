"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CreditCardIcon,
  Loader2Icon,
  SearchIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/dash/page-header";
import { HeroStatRow, HeroStatTile } from "@/components/dash/hero-stat-tile";
import { StatusStamp, CARD_STATUS_TONE } from "@/components/dash/status-stamp";
import { EmptyState } from "@/components/dash/empty-state";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

function DeleteCardPermanentlyButton({ card, onDeleted }: { card: api.Card; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteCardPermanently(card.id);
      setOpen(false);
      onDeleted(card.id);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-akosi-muted-fg hover:text-akosi-accent-2"
        >
          <Trash2Icon className="size-3.5" />
          <span className="sr-only">Delete permanently</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this card permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes code &quot;{card.uid}&quot; and its play/ownership history. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-akosi-accent-2">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={handleDelete}
            className="bg-akosi-accent-2! text-white! hover:bg-akosi-accent-2/90!"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CardRow({
  card,
  idx,
  busy,
  onToggleRevoke,
  onSoldUpdated,
  onDeleted,
}: {
  card: api.Card;
  idx: number;
  busy: boolean;
  onToggleRevoke: (card: api.Card) => void;
  onSoldUpdated: (card: api.Card) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 bg-akosi-surface py-4 pr-4 pl-5 sm:pr-5 sm:pl-6",
        card.status === "REVOKED" ? "border-akosi-fg/15" : "border-akosi-accent-2/30",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          card.status === "REVOKED" ? "bg-akosi-fg/20" : "bg-akosi-accent-2",
        )}
      />
      {/* Stacks on mobile; one row from sm up. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
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
            <div className="flex items-center gap-2">
              <p className="truncate font-mono text-base font-semibold">{card.uid}</p>
              <StatusStamp tone={CARD_STATUS_TONE[card.status] ?? "muted"} rotate={false}>
                {card.status}
              </StatusStamp>
            </div>
            <p className="truncate text-sm text-akosi-muted-fg">
              {card.trackTitle} — {card.releaseTitle} ({card.artistName})
            </p>
            {card.ownerEmail ? (
              <p className="truncate text-xs text-akosi-muted-fg">Sold to {card.ownerEmail}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-13 sm:shrink-0 sm:pl-0">
          {card.editionLabel ? (
            <Badge variant="outline" className="shrink-0 border-akosi-fg/15 text-akosi-muted-fg">
              {card.editionLabel}
            </Badge>
          ) : null}
          <span className="shrink-0 text-sm tabular-nums text-akosi-muted-fg">
            {card.playCount} play{card.playCount === 1 ? "" : "s"}
          </span>
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
          {card.status === "REVOKED" ? <DeleteCardPermanentlyButton card={card} onDeleted={onDeleted} /> : null}
        </div>
      </div>
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

  // DeleteCardPermanentlyButton already made the API call — this
  // removes the now-gone card from every open group and refreshes
  // counts (its group's `count` is stale otherwise).
  async function handleCardDeleted(id: string) {
    setExpanded((prev) => {
      const next = new Map(prev);
      for (const [key, state] of next) {
        next.set(key, { ...state, cards: state.cards.filter((c) => c.id !== id) });
      }
      return next;
    });
    api.getCardStats().then(setStats);
    const freshGroups = await api.listCardGroups({ groupBy, search: search || undefined });
    setGroups(freshGroups);
  }

  const totalShown = useMemo(() => groups?.reduce((sum, g) => sum + g.count, 0) ?? 0, [groups]);

  return (
    <AdminShell>
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="akosi admin"
          title="cards"
          word="editions"
          description="Manually provisioned cards and the tracks they unlock. Sales are hand-recorded — no checkout exists yet."
          actions={
            tracks ? (
              <>
                <BulkCreateCardsDialog tracks={tracks} onCreated={refreshAfterCreate} />
                <NewCardDialog tracks={tracks} onCreated={refreshAfterCreate} />
              </>
            ) : null
          }
        />

        {stats && stats.total > 0 ? (
          <div className="mt-6 mb-8">
            <HeroStatRow cols={3}>
              {/* The screen's single highlight: how many codes can
                  unlock a track right now. */}
              <HeroStatTile
                label="Redeemable"
                value={stats.active}
                icon={CheckCircle2Icon}
                sweep="ember"
                tilt={-1}
                highlight
                highlightNote="unlocks now"
              />
              <HeroStatTile label="Total cards" value={stats.total} icon={CreditCardIcon} sweep="plum" delay={60} />
              <HeroStatTile label="Revoked" value={stats.revoked} icon={XCircleIcon} sweep="flare" tilt={1} delay={120} />
            </HeroStatRow>
          </div>
        ) : null}

        {stats !== null && stats.total === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="no cards provisioned yet"
              body="A card is a code bound to a track — provision one and the track goes private until that code unlocks it."
              cta={tracks ? <NewCardDialog tracks={tracks} onCreated={refreshAfterCreate} /> : undefined}
            />
          </div>
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
                                      onDeleted={handleCardDeleted}
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
