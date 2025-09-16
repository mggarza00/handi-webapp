export type ChatSummary = {
  id: string;
  title: string;
  preview?: string | null;
  lastMessageAt?: string | null;
  unread?: boolean;
  avatarUrl?: string | null;
  requestTitle?: string | null;
  unreadCount?: number;
};

