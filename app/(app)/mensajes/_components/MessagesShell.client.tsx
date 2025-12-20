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

  // Oculta el header global solo en móvil (detalle) para maximizar viewport
  React.useEffect(() => {
    const cls = "hide-messages-header";
    if (onDetail) document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [onDetail]);

  return (
    <div className={`mx-auto max-w-6xl ${onDetail ? "p-0 md:p-4" : "p-4"}`}>
      <style jsx global>{`
        @media (max-width: 768px) {
          body.hide-messages-header header,
          body.hide-messages-header [data-testid="site-header"] {
            display: none !important;
          }
          body.hide-messages-header {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
        }
      `}</style>
      <div
        className={`grid grid-cols-1 md:grid-cols-[320px_1fr] ${
          onDetail
            ? "h-[100dvh] max-h-[100dvh] md:h-auto md:max-h-none gap-0"
            : "gap-4"
        }`}
      >
        {/* Sidebar chat list: hide on mobile when on detail */}
        <aside
          className={`rounded border bg-blue-50/50 border-blue-100/50 md:sticky md:top-4 md:h-[calc(100vh-8rem)] overflow-auto ${onDetail ? "hidden md:block" : "block"}`}
        >
          <ChatList chats={chats} />
        </aside>
        {/* Main pane: show on mobile only on detail; always show on md+ */}
        <main
          className={`${onDetail ? "block" : "hidden"} md:block min-h-[50vh] md:min-h-[calc(100vh-8rem)] md:h-auto md:max-h-none rounded border bg-white overflow-auto`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
