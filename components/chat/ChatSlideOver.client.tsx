"use client";
import * as React from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatPanel from "@/components/chat/ChatPanel";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  userId?: string | null;
};

export default function ChatSlideOver({ open, onOpenChange, conversationId, userId }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Chat</SheetTitle>
        </SheetHeader>
        <ChatPanel conversationId={conversationId} onClose={() => onOpenChange(false)} userId={userId ?? undefined} />
      </SheetContent>
    </Sheet>
  );
}
