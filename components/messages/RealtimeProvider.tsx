"use client";

import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase-browser";

type SupabaseClientInstance = typeof supabaseBrowser;

const RealtimeCtx = React.createContext<SupabaseClientInstance | null>(null);

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => supabaseBrowser, []);
  return <RealtimeCtx.Provider value={client}>{children}</RealtimeCtx.Provider>;
}

export const useRealtime = (): SupabaseClientInstance => {
  const ctx = React.useContext(RealtimeCtx);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
};
