"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserButtonProps = {
  loggedIn?: boolean;
  avatarUrl?: string | null;
  fullName?: string | null;
};

export default function UserButton({
  loggedIn = false,
  avatarUrl = null,
  fullName = null,
}: UserButtonProps) {
  // Evita hidración inconsistente en SSR/CSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (!loggedIn) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/auth/sign-in">Iniciar sesión</Link>
      </Button>
    );
  }

  const initials = (
    fullName
      ?.trim()
      ?.split(/\s+/)
      ?.map((p) => p[0])
      ?.slice(0, 2)
      ?.join("") || "U"
  ).toUpperCase();

  return (
    <Link href="/me" className="inline-flex items-center gap-2">
      <Avatar className="h-8 w-8">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={fullName ?? "Usuario"} />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium hidden sm:inline-block">
        {fullName ?? "Mi cuenta"}
      </span>
    </Link>
  );
}
