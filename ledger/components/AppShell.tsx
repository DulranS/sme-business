"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/permissions";
import type { Role } from "@/lib/types";

const NAV: { href: string; label: string; icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element; roles: Role[]; group: string }[] = [
  { href: "/dashboard", label: "Home", icon: GridIcon, roles: ["owner", "manager"], group: "Overview" },
  { href: "/notifications", label: "Notifications", icon: BellIcon, roles: ["owner", "manager"], group: "Overview" },

  { href: "/products", label: "Items", icon: BoxIcon, roles: ["owner", "manager"], group: "Buy & sell" },
  { href: "/purchase-orders", label: "Orders", icon: ClipboardIcon, roles: ["owner", "manager"], group: "Buy & sell" },
  { href: "/purchases", label: "Buying", icon: DownIcon, roles: ["owner", "manager"], group: "Buy & sell" },
  { href: "/sales", label: "Selling", icon: UpIcon, roles: ["owner", "manager", "staff"], group: "Buy & sell" },
  { href: "/customers", label: "Customers", icon: PeopleIcon, roles: ["owner", "manager", "staff"], group: "Buy & sell" },
  { href: "/projects", label: "Projects", icon: ProjectIcon, roles: ["owner", "manager"], group: "Buy & sell" },

  { href: "/cash-count", label: "Cash count", icon: WalletIcon, roles: ["owner", "manager", "staff"], group: "Money" },
  { href: "/cash-flow", label: "Cash flow", icon: RunwayIcon, roles: ["owner", "manager"], group: "Money" },
  { href: "/receivables-payables", label: "Money owed", icon: ClockIcon, roles: ["owner", "manager"], group: "Money" },
  { href: "/expenses", label: "Bills", icon: RepeatIcon, roles: ["owner", "manager"], group: "Money" },
  { href: "/loans", label: "Loans", icon: LoanIcon, roles: ["owner", "manager"], group: "Money" },
  { href: "/profitability", label: "Profit", icon: TrendIcon, roles: ["owner", "manager"], group: "Money" },
  { href: "/statements", label: "Reports", icon: StatementIcon, roles: ["owner", "manager"], group: "Money" },

  { href: "/time", label: "Time", icon: TimerIcon, roles: ["owner", "manager", "staff"], group: "Team" },
  { href: "/employees", label: "Employees", icon: PeopleIcon, roles: ["owner"], group: "Team" },
  { href: "/team", label: "Team access", icon: TeamIcon, roles: ["owner"], group: "Team" },

  { href: "/import-export", label: "CSV", icon: FileIcon, roles: ["owner"], group: "Admin" },
  { href: "/activity", label: "Activity", icon: ClockIcon, roles: ["owner"], group: "Admin" },
  { href: "/settings", label: "Settings", icon: GearIcon, roles: ["owner"], group: "Admin" },
];

const GROUP_ORDER = ["Overview", "Buy & sell", "Money", "Team", "Admin"];

// A handful of items per role that earn a permanent slot in the mobile
// bottom bar — the things done most often, day to day. Everything else
// lives one tap away behind "More" rather than in a horizontally-scrolling
// row of 18 icons, which hides items with no indication there's more to
// scroll to and makes every tap a guess. This mirrors how every mobile app
// with a deep nav tree (not just 4-5 top-level sections) actually solves
// this — Instagram, Amazon, banking apps — a short fixed bar plus a "More"
// entry point.
const MOBILE_PRIMARY_HREFS: Record<Role, string[]> = {
  owner: ["/dashboard", "/sales", "/purchases", "/receivables-payables"],
  manager: ["/dashboard", "/sales", "/purchases", "/receivables-payables"],
  staff: ["/sales", "/cash-count", "/time"],
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, memberName, memberActive, loading, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/join";
  // The admin-only account-provisioning tool is deliberately outside the
  // normal signed-in-user chrome: it isn't part of any business's
  // dashboard, it's gated by its own passcode rather than a login, and an
  // admin using it may or may not also be signed into a business in this
  // same browser. It must never bounce a signed-out visitor to /login
  // (that's the whole point — it's how accounts get created before anyone
  // can log in) and never bounce a signed-in owner away from it either.
  const isStandalonePage = isAuthPage || pathname.startsWith("/admin/");
  const homeForRole = role === "staff" ? "/sales" : "/dashboard";

  useEffect(() => {
    if (loading) return;
    if (!user && !isStandalonePage) router.replace("/login");
    if (user && isAuthPage) router.replace(homeForRole);
    if (user && pathname === "/") router.replace(homeForRole);
  }, [loading, user, isAuthPage, isStandalonePage, pathname, router, homeForRole]);

  // Close the "More" sheet automatically on navigation so it never lingers
  // open over the next page.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Same background-scroll lock + Escape-to-close as the shared Modal
  // component (see components/ui.tsx). This sheet is hand-rolled rather
  // than built on top of Modal because it needs its own bottom-nav-aware
  // trigger, but it's still a full-screen overlay and without this the
  // page underneath keeps scrolling/rubber-banding on touch while the
  // sheet is open — the exact "stickiness" Modal was built to avoid.
  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  if (isStandalonePage || pathname === "/") {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (user && role && !memberActive) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-sm font-medium text-fg">Your access has been turned off</div>
          <div className="text-sm text-muted mt-1 max-w-sm">
            Whoever runs this business has deactivated your account. Talk to them if this seems wrong.
          </div>
          <button onClick={() => signOut()} className="text-sm text-muted hover:text-fg mt-4 underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const visibleNav = NAV.filter((item) => !role || item.roles.includes(role));
  const primaryHrefs = role ? MOBILE_PRIMARY_HREFS[role] : [];
  const primaryNav = visibleNav.filter((item) => primaryHrefs.includes(item.href));
  const restNav = visibleNav.filter((item) => !primaryHrefs.includes(item.href));
  const restHasActive = restNav.some((item) => pathname.startsWith(item.href));

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-56 shrink-0 border-r border-line flex-col justify-between h-screen sticky top-0">
        <div className="overflow-y-auto scroll-touch">
          <div className="px-5 py-5 border-b border-line">
            <div className="font-display text-base font-bold tracking-tight">Ledger</div>
            <div className="text-[11px] text-muted mt-0.5">solo SME finance</div>
          </div>
          <nav className="p-2.5">
            {GROUP_ORDER.map((group) => {
              const items = visibleNav.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-3.5 last:mb-1">
                  <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-muted/70 font-semibold">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = pathname.startsWith(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={clsx(
                            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors border-l-2",
                            active
                              ? "bg-panel2 text-fg border-amber font-medium"
                              : "text-muted border-transparent hover:text-fg hover:bg-panel2"
                          )}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
        <div className="p-3 border-t border-line shrink-0">
          <div className="px-1 mb-2">
            <div className="text-xs text-fg truncate font-medium">{memberName ?? user.email}</div>
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              {role && <span className="px-1.5 py-0.5 rounded border border-line bg-panel2">{roleLabel(role)}</span>}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full text-left text-sm text-muted hover:text-fg px-3 py-2 rounded-md hover:bg-panel2"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="sm:hidden safe-top flex items-center justify-between px-4 py-3.5 border-b border-line sticky top-0 bg-ink z-30">
          <div>
            <div className="font-display text-base font-bold leading-none">Ledger</div>
            {role && <div className="text-[10px] text-muted mt-0.5">{roleLabel(role)}</div>}
          </div>
          <button onClick={() => signOut()} className="text-xs text-muted min-h-[44px] px-2 -mr-2">
            Sign out
          </button>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-8 pb-24 sm:pb-8 max-w-6xl w-full mx-auto overflow-x-hidden">
          {children}
        </main>

        {/* Mobile bottom nav — a short, fixed set of the most-used
            destinations for this role, plus a "More" entry point for
            everything else. Nothing scrolls or gets clipped. */}
        <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-panel border-t border-line flex safe-bottom z-30">
          {primaryNav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[10px]",
                  active ? "text-amber-soft" : "text-muted"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          })}
          {restNav.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className={clsx(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[10px]",
                restHasActive ? "text-amber-soft" : "text-muted"
              )}
              aria-label="More"
            >
              <MoreIcon className="w-[18px] h-[18px]" />
              More
            </button>
          )}
        </nav>

        {/* "More" sheet: everything not pinned to the bottom bar, grouped
            in one tap-friendly grid instead of a second layer of scrolling. */}
        {moreOpen && (
          <div className="sm:hidden fixed inset-0 z-40 flex items-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More"
              className="relative w-full bg-panel border-t border-line rounded-t-lg max-h-[80vh] overflow-y-auto scroll-touch p-5 pb-8 safe-bottom">
              <div className="w-9 h-1 rounded-full bg-line mx-auto -mt-1 mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-medium">More</h2>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="text-muted hover:text-fg w-9 h-9 flex items-center justify-center rounded-md hover:bg-panel2"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {GROUP_ORDER.map((group) => {
                const items = restNav.filter((item) => item.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group} className="mb-4 last:mb-0">
                    <div className="px-1 pb-2 text-[10px] uppercase tracking-wider text-muted/70 font-semibold">
                      {group}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {items.map((item) => {
                        const active = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                              "flex flex-col items-center justify-center gap-1.5 rounded-lg border py-4 px-2 text-xs text-center min-h-[76px]",
                              active
                                ? "border-amber-dim bg-panel2 text-fg font-medium"
                                : "border-line text-muted hover:bg-panel2 hover:text-fg"
                            )}
                          >
                            <Icon className="w-5 h-5 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="mt-5 pt-4 border-t border-line">
                <div className="text-xs text-fg truncate font-medium">{memberName ?? user.email}</div>
                {role && (
                  <div className="text-[11px] text-muted mt-1">
                    <span className="px-1.5 py-0.5 rounded border border-line bg-panel2">{roleLabel(role)}</span>
                  </div>
                )}
                <button
                  onClick={() => signOut()}
                  className="w-full text-left text-sm text-muted hover:text-fg px-0 py-3 mt-1 min-h-[44px]"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 7.5v9L12 21l9-4.5v-9" />
      <path d="M12 12v9" />
    </svg>
  );
}
function ClipboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}
function ProjectIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function DownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 3v14" />
      <path d="m5 11 7 7 7-7" />
      <path d="M5 21h14" />
    </svg>
  );
}
function UpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 21V7" />
      <path d="m5 13 7-7 7 7" />
      <path d="M5 3h14" />
    </svg>
  );
}
function RepeatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function TrendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
function PeopleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5" />
      <circle cx="17.5" cy="8.5" r="2.3" />
      <path d="M16 14.6c2.4.4 4.2 2.2 4.7 4.6" />
    </svg>
  );
}
function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function LoanIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15.5s.9 1.5 3 1.5 3-1.1 3-2.3c0-3-6-1.7-6-4.6C9 9 10.3 8 12 8s3 1 3 1" />
      <path d="M12 6.5V8M12 16.5V18" />
    </svg>
  );
}
function StatementIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M6 2h9l4 4v16H6Z" />
      <path d="M15 2v4h4" />
      <path d="M8.5 12h7M8.5 15.5h7M8.5 8.5h3" />
    </svg>
  );
}
function GearIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
function TimerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 2h4" />
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M18.5 6.5 20 5" />
    </svg>
  );
}

function WalletIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5Z" />
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <circle cx="16" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function RunwayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 20 20 4" />
      <path d="M4 4h6M4 4v6" />
      <path d="M20 20h-6M20 20v-6" />
    </svg>
  );
}
function TeamIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.4" />
      <path d="M2.5 20c.6-3.3 2.9-5.3 5.5-5.3s4.9 2 5.5 5.3" />
      <path d="M14.5 15.2c2 .2 3.7 1.9 4.2 4.8" />
    </svg>
  );
}
function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function MoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
