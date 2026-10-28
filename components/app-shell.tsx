"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { Icon } from "./icons";
import { RecentMessages } from "./recent-messages";

const baseNavigation = [
  { href: "/", label: "Discover sessions", icon: "game" as const },
  { href: "/messages", label: "Messages", icon: "message" as const },
  { href: "/rankings", label: "Rankings", icon: "game" as const },
  { href: "/tickets", label: "Live tickets", icon: "tickets" as const },
  { href: "/games", label: "My games", icon: "game" as const },
  { href: "/account", label: "Account", icon: "user" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, displayName } = useAuth();
  const [open, setOpen] = useState(false);
  const navigation = baseNavigation;
  const name =
    displayName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Player";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="mobile-header">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Icon name="game" />
          </span>
          Game-On<span className="brand-bang">!</span>
        </Link>
        <button
          className="icon-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </header>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="sidebar"
        className={`sidebar ${open ? "sidebar-open" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <Link
          href="/"
          className="brand desktop-brand"
          aria-label="Game-On home"
          onClick={() => setOpen(false)}
        >
          <span className="brand-symbol">
            <Icon name="game" />
          </span>
          <span className="sidebar-brand-text">Game-On<span className="brand-bang">!</span></span>
        </Link>
        <div className="sidebar-label">YOUR NEXT SESSION</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              onClick={() => setOpen(false)}
              className={`nav-link ${(pathname === href || (href === "/tickets" && pathname.startsWith("/tickets/"))) ? "active" : ""}`}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon name={icon} />
              <span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>
        <RecentMessages onNavigate={() => setOpen(false)} />
        <div className="sidebar-note">
          <span className="note-icon">
            <Icon name="game" />
          </span>
          <p>
            Good games start
            <br />
            with good teammates.
          </p>
          <span>Find your people. Press play.</span>
        </div>
        <Link
          href={user ? `/players/${user.id}` : "/account"}
          className="sidebar-account"
          aria-label={user ? `${name}: View your profile` : "Sign in to get started"}
          title={user ? "View your profile" : "Sign in"}
          onClick={() => setOpen(false)}
        >
          <span className="avatar">
            <Icon name="user" />
          </span>
          <span>
            <strong>
              {loading ? "Loading account…" : user ? name : "Join the party"}
            </strong>
            <small>
              {user ? "View your profile" : "Sign in to get started"}
            </small>
          </span>
          <Icon name="arrow" />
        </Link>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>FIND TEAMMATES. GAME TOGETHER.</span>
          <Link href="/account" className="topbar-account">
            <Icon name="user" />
            {user ? name : "Sign in"}
          </Link>
        </div>
        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
