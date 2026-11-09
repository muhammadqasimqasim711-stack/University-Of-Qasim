"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminViewMode, useSessionRole } from "@/app/session-context";

const adminLinks = [
  { href: "/configuration", label: "Master Configuration" },
  { href: "/requests", label: "Requests" },
  { href: "/profiles", label: "Profiles" },
  { href: "/students", label: "Students" },
  { href: "/teachers", label: "Teachers" },
  { href: "/books", label: "Books" },
  { href: "/book-ledger", label: "Book ledger" },
  { href: "/issued-books", label: "Issued books" },
  { href: "/book-requests", label: "Book requests" },
];

const userLinks = [
  { href: "/books", label: "Books" },
  { href: "/my-book-ledger", label: "Book ledger" },
  { href: "/profile", label: "My Profile" },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useSessionRole();
  const { adminViewMode, setAdminViewMode } = useAdminViewMode();
  const [pending, setPending] = useState(false);

  if (!role) {
    return null;
  }

  const isViewingAsUser = role === "admin" && adminViewMode === "student-teacher";
  const links = isViewingAsUser ? userLinks : role === "admin" ? adminLinks : userLinks;

  async function logout() {
    setPending(true);
    try {
      setAdminViewMode("admin");
      await fetch("/api/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {isViewingAsUser ? (
        <aside className="admin-view-banner" aria-label="Administrator View Mode">
          <div className="admin-view-banner-inner">
            <div className="admin-view-banner-text">
              <span className="admin-view-badge">🛡️ Admin View Mode</span>
              <span>
                You are viewing the library portal as <strong>Student &amp; Teacher</strong> (View Only as Administrator).
              </span>
            </div>
            <button
              type="button"
              className="button-return-admin"
              onClick={() => {
                setAdminViewMode("admin");
                router.push("/configuration");
              }}
            >
              ↩ Return to Admin Dashboard
            </button>
          </div>
        </aside>
      ) : null}

      <header className="site-header">
        <div className="site-header-inner">
          <nav className="site-nav" aria-label="Library">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="site-corner-action">

            <button
              type="button"
              className="button-logout"
              disabled={pending}
              onClick={() => void logout()}
              aria-label="Log out"
            >
              <svg
                className="logout-icon"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>{pending ? "Logging out…" : "Log out"}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
