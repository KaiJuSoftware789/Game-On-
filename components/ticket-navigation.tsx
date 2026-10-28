"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TicketNavigation() {
  const pathname = usePathname();
  if (pathname === "/tickets/new") return null;
  return (
    <nav className="ticket-navigation" aria-label="Ticket categories">
      {[
        { href: "/tickets", label: "Online sessions" },
        { href: "/tickets/events", label: "Local events" },
      ].map(({ href, label }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
