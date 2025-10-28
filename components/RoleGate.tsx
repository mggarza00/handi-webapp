"use client";

import React from "react";

import { useAdminAuth } from "@/hooks/use-admin-auth";

type Props = {
  roles: Array<"owner" | "admin" | "ops" | "finance" | "support" | "reviewer">;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export default function RoleGate({ roles, fallback = null, children }: Props) {
  const { role } = useAdminAuth();
  const ok = !!role && roles.map((r) => r.toLowerCase()).includes((role.toLowerCase() as unknown) as Props["roles"][number]);
  return ok ? <>{children}</> : <>{fallback}</>;
}
