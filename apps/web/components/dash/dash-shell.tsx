"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type DashNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Match only the exact path (for the index route) instead of prefix.
  exact?: boolean;
};

function isActive(item: DashNavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

// One responsive shell for both portals (admin + artist): collapsible
// sidebar from lg up, slim top bar plus a bottom tab bar (≤4 items +
// "More") below that. Tab targets are ≥44px and the bar pads for the
// home-indicator safe area.
export function DashShell({
  navItems,
  homeHref,
  accountLabel,
  accountSub,
  accountHref,
  onSignOut,
  children,
}: {
  navItems: DashNavItem[];
  homeHref: string;
  accountLabel: string;
  accountSub?: string;
  accountHref?: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const tabItems = navItems.slice(0, 4);
  const overflowItems = navItems.slice(4);
  const initials = accountLabel.slice(0, 2).toUpperCase();

  const accountChip = (
    <div className="flex items-center gap-2.5 rounded-full border border-akosi-fg/10 bg-akosi-surface py-1 pr-3 pl-1">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-xs font-medium text-white">
        {initials}
      </div>
      <span className="min-w-0 truncate text-sm text-akosi-fg">{accountLabel}</span>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-akosi-bg font-sans text-akosi-fg lg:flex-row">
      {/* Desktop sidebar — collapsible to an icon rail. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-y-auto border-r-2 border-akosi-fg/10 bg-akosi-surface/50 py-6 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.25rem] px-2.5" : "w-60 px-4",
        )}
      >
        <div className={cn("mb-8 flex items-center", collapsed ? "justify-center" : "px-2")}>
          {collapsed ? (
            <span aria-hidden className="font-display text-2xl font-bold text-akosi-accent">
              ♪
            </span>
          ) : (
            <Link href={homeHref}>
              <AkosiWordmark />
            </Link>
          )}
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-akosi-accent text-white"
                    : "text-akosi-muted-fg hover:bg-akosi-fg/5 hover:text-akosi-fg",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-akosi-muted-fg transition-colors hover:bg-akosi-fg/5 hover:text-akosi-fg"
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-4" />
          ) : (
            <>
              <PanelLeftCloseIcon className="size-4" /> Collapse
            </>
          )}
          <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top bar: full account row on desktop, wordmark + theme on mobile. */}
        <header className="flex items-center justify-between gap-3 border-b-2 border-akosi-fg/10 px-4 py-3 sm:px-8 lg:justify-end lg:py-3.5">
          <Link href={homeHref} className="lg:hidden">
            <AkosiWordmark className="h-9" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-3 lg:flex">
              {accountHref ? <Link href={accountHref}>{accountChip}</Link> : accountChip}
              <Button
                variant="ghost"
                size="sm"
                className="text-akosi-muted-fg hover:text-akosi-fg"
                onClick={onSignOut}
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>

        {/* pb clears the fixed tab bar on mobile. */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-0">{children}</div>
      </div>

      {/* Mobile bottom tab bar: up to 4 destinations + More. */}
      <nav
        aria-label="Primary"
        className="akosi-tabbar fixed inset-x-0 bottom-0 z-40 border-t-2 border-akosi-fg/10 bg-akosi-surface lg:hidden"
      >
        <div className="flex">
          {tabItems.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-akosi-accent-2" : "text-akosi-muted-fg",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-akosi-muted-fg"
              >
                <MenuIcon className="size-5" />
                More
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl border-t-2 border-akosi-fg/15 bg-akosi-surface pb-8">
              <SheetHeader>
                <SheetTitle className="font-display lowercase">more</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex min-h-11 items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium text-akosi-fg hover:bg-akosi-fg/5"
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-akosi-fg/15 pt-4">
                  <div className="min-w-0">
                    {accountHref ? (
                      <Link href={accountHref} onClick={() => setMoreOpen(false)}>
                        {accountChip}
                      </Link>
                    ) : (
                      accountChip
                    )}
                    {accountSub ? (
                      <p className="mt-1 truncate pl-1 text-xs text-akosi-muted-fg">{accountSub}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-akosi-muted-fg hover:text-akosi-fg"
                    onClick={onSignOut}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
