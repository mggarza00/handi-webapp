"use client";
import * as React from "react";
import { usePathname } from "next/navigation";

import ChatList from "./ChatList";
import type { ChatSummary } from "./types";

export default function MessagesShell({
  chats,
  children,
}: {
  chats: ChatSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const onDetail = /^\/mensajes\/[\w-]+/i.test(pathname);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar chat list: hide on mobile when on detail */}
        <aside
          className={`rounded border bg-blue-50/50 border-blue-100/50 md:sticky md:top-4 md:h-[calc(100vh-8rem)] overflow-auto ${onDetail ? "hidden md:block" : "block"}`}
        >
          <ChatList chats={chats} />
        </aside>
        {/* Main pane: show on mobile only on detail; always show on md+ */}
        <main
          className={`${onDetail ? "block" : "hidden"} md:block min-h-[50vh] rounded border bg-white overflow-hidden`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
