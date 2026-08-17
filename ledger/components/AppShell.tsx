"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { href: "/dashboard", label: "Home", icon: GridIcon },
  { href: "/products", label: "Items", icon: BoxIcon },
  { href: "/purchase-orders", label: "Orders", icon: ClipboardIcon },
  { href: "/purchases", label: "Buying", icon: DownIcon },
  { href: "/sales", label: "Selling", icon: UpIcon },
  { href: "/projects", label: "Projects", icon: ProjectIcon },
  { href: "/employees", label: "Employees", icon: PeopleIcon },
  { href: "/expenses", label: "Bills", icon: RepeatIcon },
  { href: "/loans", label: "Loans", icon: LoanIcon },
  { href: "/profitability", label: "Profit", icon: TrendIcon },
  { href: "/statements", label: "Reports", icon: StatementIcon },
  { href: "/import-export", label: "CSV", icon: FileIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const isAuthPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthPage) router.replace("/login");
    if (user && isAuthPage) router.replace("/dashboard");
    if (user && pathname === "/") router.replace("/dashboard");
  }, [loading, user, isAuthPage, pathname, router]);

  if (isAuthPage || pathname === "/") {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-56 shrink-0 border-r border-line flex-col justify-between h-screen sticky top-0">
        <div>
          <div className="px-5 py-5 border-b border-line">
            <div className="font-display text-base font-bold tracking-tight">Ledger</div>
            <div className="text-[11px] text-muted mt-0.5">solo SME finance</div>
          </div>
          <nav className="p-2.5 space-y-0.5">
            {NAV.map((item) => {
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
          </nav>
        </div>
        <div className="p-3 border-t border-line">
          <div className="text-xs text-muted truncate px-1 mb-2">{user.email}</div>
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
        <header className="sm:hidden flex items-center justify-between px-4 py-3.5 border-b border-line sticky top-0 bg-ink z-30">
          <div className="font-display text-base font-bold">Ledger</div>
          <button onClick={() => signOut()} className="text-xs text-muted">
            Sign out
          </button>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-8 sm:py-8 pb-24 sm:pb-8 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile bottom nav — horizontally scrollable since there are more items than fit one screen */}
        <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-panel border-t border-line flex overflow-x-auto z-30">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-1 py-2.5 px-3.5 text-[10px] shrink-0",
                  active ? "text-amber-soft" : "text-muted"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
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
function ProjectIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
