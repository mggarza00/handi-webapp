"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Search as SearchIcon, Menu } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import NotificationsDropdown from "@/components/NotificationsDropdown.client";

type Props = {
  userEmail?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export default function AdminTopbar({ userEmail, fullName, avatarUrl }: Props) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  const displayName = fullName || userEmail || "usuario";
  const hasUser = Boolean(userEmail);

  return (
    <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile bar */}
      <div className="grid h-14 grid-cols-[44px_1fr_44px] items-center gap-x-2 pr-2 md:hidden">
        {/* Left: sidebar trigger, flush left */}
        <div className="flex items-center pl-2">
          <SidebarTrigger className="inline-flex ml-1" aria-label="Abrir menú">
            <Menu className="h-4 w-4" />
          </SidebarTrigger>
        </div>
        {/* Center: logo */}
        <div className="flex items-center justify-center">
          <Link href="/" className="inline-flex items-center" prefetch={false}>
            <Image
              src="/images/Logo-Handi-v2.gif"
              alt="Handi"
              width={52}
              height={52}
              className="h-[52px] w-[52px] object-contain"
              priority
            />
          </Link>
        </div>
        {/* Right: actions (search icon, notifications, avatar) */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white text-foreground hover:bg-neutral-100 focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          {hasUser ? (
            <>
              <NotificationsDropdown />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile search drawer (below bar) */}
      {searchOpen ? (
        <div className="px-2 pb-2 md:hidden">
          <input
            type="search"
            placeholder="Buscar..."
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            autoFocus
          />
        </div>
      ) : null}

      {/* Desktop / md+ bar aligned with sidebar */}
      <div className="hidden md:grid h-14 grid-cols-[260px_1fr] items-center gap-x-3 md:gap-x-4">
        {/* Left: aligned with sidebar content (aside has p-3) */}
        <div className="flex items-center gap-2 pl-4">
          <Link href="/" className="inline-flex items-center ml-2" prefetch={false}>
            <Image
              src="/images/Logo-Handi-v2.gif"
              alt="Handi"
              width={52}
              height={52}
              className="h-[52px] w-[52px] object-contain"
              priority
            />
          </Link>
        </div>
        {/* Right: search input + actions */}
        <div className="flex items-center gap-3 pr-3 md:pr-4 justify-end">
          <input
            type="search"
            placeholder="Buscar..."
            className="h-9 w-40 md:w-64 rounded-md border bg-background px-3 text-sm"
          />
          {hasUser ? (
            <>
              <NotificationsDropdown />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <div className="hidden text-sm md:block opacity-70">{displayName}</div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
