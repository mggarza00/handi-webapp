export type ChatAttachment = {
  id?: string;
  filename: string;
  mime_type: string;
  byte_size?: number | null;
  width?: number | null;
  height?: number | null;
  storage_path: string;
  created_at?: string;
};

export function appendAttachment<T extends { id: string; attachments?: ChatAttachment[] }>(
  messages: T[],
  messageId: string,
  att: ChatAttachment,
): T[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    const list = Array.isArray(m.attachments) ? m.attachments : [];
    const exists = list.some((x) => (att.id && x.id === att.id) || x.storage_path === att.storage_path);
    return exists ? m : ({ ...m, attachments: [...list, att] } as T);
  });
}

export function removeAttachment<T extends { id: string; attachments?: ChatAttachment[] }>(
  messages: T[],
  messageId: string,
  attachmentId: string,
): T[] {
  return messages.map((m) =>
    m.id === messageId
      ? ({ ...m, attachments: (m.attachments || []).filter((a) => a.id !== attachmentId) } as T)
      : m,
  );
}
