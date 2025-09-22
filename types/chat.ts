// Canonical app-level types (camelCase)
export type Conversation = {
  id: string;
  requestId: string;
  customerId: string;
  proId: string;
  lastMessageAt: string;
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readBy: string[];
  messageType: string;
  payload: Record<string, unknown> | null;
};

export type UserMini = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

// Alias con la forma solicitada (name en lugar de fullName)
export type UserRef = {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
};

export type StartConversationInput = {
  requestId: string;
  peerId: string;
  initialBody?: string | null;
};

export type SendMessageInput = {
  requestId: string;
  proId: string;
  body: string;
};

// DB row shapes (snake_case) for mapping
export type ConversationRow = {
  id?: string | null;
  request_id?: string | null;
  customer_id?: string | null;
  pro_id?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
};

export type MessageRow = {
  id?: string | null;
  conversation_id?: string | null;
  sender_id?: string | null;
  body?: string | null;
  text?: string | null; // legacy field support
  created_at?: string | null;
  read_by?: unknown;
  message_type?: string | null;
  payload?: unknown;
};

export type ProfileRow = {
  id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export function mapConversationRow(row: ConversationRow): Conversation {
  return {
    id: String(row.id ?? ""),
    requestId: String(row.request_id ?? ""),
    customerId: String(row.customer_id ?? ""),
    proId: String(row.pro_id ?? ""),
    lastMessageAt: String(row.last_message_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function mapMessageRow(row: MessageRow): Message {
  const readBy = (() => {
    const v = row.read_by as unknown;
    if (Array.isArray(v)) return v.map((x) => String(x));
    try {
      if (typeof v === "string" && v.trim().length) {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
      }
    } catch {
      // ignore
    }
    return [] as string[];
  })();
  const body = (row.body ?? row.text ?? "").toString();
  const payload = (() => {
    const raw = row.payload as unknown;
    if (!raw) return null;
    if (typeof raw === "string" && raw.trim().length) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (typeof raw === "object") return raw as Record<string, unknown>;
    return null;
  })();
  return {
    id: String(row.id ?? ""),
    conversationId: String(row.conversation_id ?? ""),
    senderId: String(row.sender_id ?? ""),
    body,
    createdAt: String(row.created_at ?? ""),
    readBy,
    messageType: (row.message_type ?? 'text').toString(),
    payload,
  };
}

export function mapProfileRowToUserMini(row: ProfileRow): UserMini {
  return {
    id: String(row.id ?? ""),
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
  };
}
