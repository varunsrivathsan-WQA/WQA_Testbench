"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/dashboard", label: "Drops" },
  { href: "/templates", label: "Templates" },
  { href: "/settings", label: "API" },
];

export default function Nav({ name }: { name: string }) {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link href="/dashboard" className="brand">
          WQA <span>Testbench</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) || (l.href === "/dashboard" && path.startsWith("/drops")) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-user">
          <span className="who">{name}</span>
          <button className="btn btn-link small" onClick={() => signOut({ callbackUrl: "/signin" })}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
