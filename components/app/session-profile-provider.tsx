"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionProfileSnapshot } from "@/lib/auth/session";

const SessionProfileContext = createContext<SessionProfileSnapshot | null>(null);

export function SessionProfileProvider({
  value,
  children,
}: {
  value: SessionProfileSnapshot;
  children: ReactNode;
}) {
  return <SessionProfileContext.Provider value={value}>{children}</SessionProfileContext.Provider>;
}

export function useSessionProfile(): SessionProfileSnapshot {
  const ctx = useContext(SessionProfileContext);
  if (!ctx) {
    throw new Error("useSessionProfile must be used within SessionProfileProvider");
  }
  return ctx;
}
