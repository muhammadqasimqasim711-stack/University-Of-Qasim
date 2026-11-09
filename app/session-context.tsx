"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Role } from "@/lib/session";

export type AdminViewMode = "admin" | "student-teacher";

type SessionContextType = {
  role: Role | null;
  adminViewMode: AdminViewMode;
  setAdminViewMode: (mode: AdminViewMode) => void;
};

const SessionContext = createContext<SessionContextType>({
  role: null,
  adminViewMode: "admin",
  setAdminViewMode: () => {},
});

const adminViewEvent = "uoq-admin-view-mode";

function subscribeToAdminView(onStoreChange: () => void) {
  window.addEventListener(adminViewEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(adminViewEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readAdminViewMode(): AdminViewMode {
  const saved = localStorage.getItem("uoq_admin_view_mode");
  return saved === "student-teacher" ? "student-teacher" : "admin";
}

export function SessionProvider({
  role,
  children,
}: {
  role: Role | null;
  children: ReactNode;
}) {
  const storedViewMode = useSyncExternalStore(
    subscribeToAdminView,
    readAdminViewMode,
    () => "admin" as const,
  );
  const adminViewMode = role === "admin" ? storedViewMode : "admin";

  function setAdminViewMode(mode: AdminViewMode) {
    localStorage.setItem("uoq_admin_view_mode", mode);
    window.dispatchEvent(new Event(adminViewEvent));
  }

  return (
    <SessionContext.Provider value={{ role, adminViewMode, setAdminViewMode }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionRole() {
  const ctx = useContext(SessionContext);
  return ctx.role;
}

export function useAdminViewMode() {
  const ctx = useContext(SessionContext);
  return {
    adminViewMode: ctx.adminViewMode,
    setAdminViewMode: ctx.setAdminViewMode,
  };
}
