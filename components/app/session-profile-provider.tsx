"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionProfileSnapshot } from "@/lib/auth/session";

export type SessionProfilePatch = Partial<Pick<SessionProfileSnapshot, "displayName" | "avatarUrl">>;

type SessionProfileContextValue = SessionProfileSnapshot & {
  patchSessionProfile: (patch: SessionProfilePatch) => void;
};

const SessionProfileContext = createContext<SessionProfileContextValue | null>(null);

export function SessionProfileProvider({
  value,
  children,
}: {
  value: SessionProfileSnapshot;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState(value);

  useEffect(() => {
    setProfile(value);
  }, [value.userId, value.displayName, value.avatarUrl, value.email, value.role]);

  const patchSessionProfile = useCallback((patch: SessionProfilePatch) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const contextValue = useMemo(
    () => ({ ...profile, patchSessionProfile }),
    [profile, patchSessionProfile],
  );

  return (
    <SessionProfileContext.Provider value={contextValue}>{children}</SessionProfileContext.Provider>
  );
}

export function useSessionProfile(): SessionProfileSnapshot {
  const ctx = useContext(SessionProfileContext);
  if (!ctx) {
    throw new Error("useSessionProfile must be used within SessionProfileProvider");
  }
  const { patchSessionProfile: _patch, ...profile } = ctx;
  return profile;
}

export function usePatchSessionProfile(): (patch: SessionProfilePatch) => void {
  const ctx = useContext(SessionProfileContext);
  if (!ctx) {
    throw new Error("usePatchSessionProfile must be used within SessionProfileProvider");
  }
  return ctx.patchSessionProfile;
}
