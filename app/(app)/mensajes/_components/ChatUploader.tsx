"use client";

import * as React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type UploadItem = {
  id: string;
  file: File;
  progress: number; // 0..100
  status: "idle" | "uploading" | "saving" | "done" | "error";
  error?: string | null;
  storagePath?: string;
  width?: number | null;
  height?: number | null;
};

export const MAX_FILES = 10;
export const MAX_MB = 20; // 20 MB por archivo
export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  // Tolerar PDFs silenciosos y tipos desconocidos
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;
export const ACCEPT = ACCEPTED_MIME_TYPES.join(",");

export type ChatUploaderProps = {
  conversationId: string;
  accept?: string; // e.g. "image/*,application/pdf"
  maxFiles?: number; // default MAX_FILES
  maxBytes?: number; // per-file, default MAX_MB in bytes
  disabled?: boolean;
  // Optional content to send together with attachments (e.g., caption)
  content?: string;
  // Callback once server message is created
  onDone?: (result: { ok: boolean; messageId?: string | null; createdAt?: string | null; error?: string }) => void;
  // Alias simple: notifica sólo éxito
  onUploaded?: () => void;
  // Informa inmediatamente al contenedor para pintar optimista (sin esperar realtime)
  onMessageCreated?: (info: { messageId: string; createdAt: string | null; attachments: Array<{ filename: string; mime_type: string; byte_size: number; storage_path: string; width?: number | null; height?: number | null; }> }) => void;
  // Estrategia: 'draft-first' (recomendado) o 'upload-first'
  mode?: 'draft-first' | 'upload-first';
};

// Props mínimos sugeridos
export type Props = Pick<ChatUploaderProps, "conversationId" | "onUploaded">;

function makeId(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 150);
}

async function getImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const url = URL.createObjectURL(file);
    try {
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        img.onerror = () => reject(new Error("image_load_error"));
        img.src = url;
      });
      return size;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export default function ChatUploader({
  conversationId,
  accept = ACCEPT,
  maxFiles = MAX_FILES,
  maxBytes = MAX_MB * 1024 * 1024,
  disabled = false,
  content,
  onDone,
  onUploaded,
  onMessageCreated,
  mode = 'draft-first',
}: ChatUploaderProps) {
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [busy, setBusy] = React.useState(false);

  const onPick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFiles = React.useCallback(
    async (filesList: FileList | null) => {
      if (!filesList || filesList.length === 0) return;
      const files = Array.from(filesList).slice(0, maxFiles);
      const initial: UploadItem[] = files.map((f) => ({
        id: `${Date.now()}_${makeId(6)}`,
        file: f,
        progress: 0,
        status: "idle",
        error: null,
      }));
      setItems(initial);
      setBusy(true);

      try {
        const uploaded: Array<{
          filename: string;
          mime_type: string;
          byte_size: number;
          storage_path: string;
          width?: number | null;
          height?: number | null;
        }> = [];
        if (mode === 'draft-first') {
          // 1) Crear draft
          const draftRes = await fetch(`/api/messages/${conversationId}/draft`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' } });
          const draftJson = (await draftRes.json().catch(() => ({}))) as { ok?: boolean; data?: { id?: string; created_at?: string } };
          if (!draftRes.ok || draftJson?.ok === false || !draftJson?.data?.id) {
            const errMsg = typeof (draftJson as Record<string, unknown>)?.error === 'string' ? (draftJson as Record<string, unknown>).error as string : 'No se pudo crear el borrador';
            throw new Error(errMsg);
          }
          const messageId = String(draftJson.data.id);
          const createdAt = draftJson.data.created_at ? String(draftJson.data.created_at) : null;

          // 2) Subir bajo messageId
          for (let i = 0; i < initial.length; i++) {
            const it = initial[i];
            const f = it.file;
            if (f.size > maxBytes) { setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', error: 'Archivo > límite' } : p)); continue; }
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'uploading', progress: 10 } : p));
            const size = await getImageSize(f);
            const safe = sanitizeFilename(f.name);
            const path = `conversation/${conversationId}/${messageId}/${safe}`;
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, progress: 25 } : p));
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            const extToMime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
            // Si file.type es "", trátalo como application/octet-stream (Windows)
            const chosenMime = (f.type === '' ? 'application/octet-stream' : (f.type || extToMime[ext] || 'application/octet-stream'));
            const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, f, { contentType: chosenMime, upsert: false });
            if (upErr) { setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', error: upErr.message, progress: 0 } : p)); continue; }
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, progress: 70, storagePath: path } : p));
            uploaded.push({ filename: f.name, mime_type: chosenMime, byte_size: f.size, storage_path: path, width: size?.width ?? null, height: size?.height ?? null });
          }
          // 3) Registrar adjuntos y patch contenido
          let ok = true;
          let serverAttachments: Array<{ filename: string; mime_type: string; byte_size: number; storage_path: string; width?: number | null; height?: number | null; id?: string; created_at?: string; message_id?: string; conversation_id?: string; }> = [];
          if (uploaded.length > 0) {
            const reg = await fetch(`/api/messages/${messageId}/attachments`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ attachments: uploaded }) });
            const regJson = (await reg.json().catch(() => ({}))) as { ok?: boolean; attachments?: unknown };
            ok = reg.ok && regJson?.ok !== false;
            if (ok && Array.isArray(regJson?.attachments)) {
              serverAttachments = regJson.attachments as typeof serverAttachments;
            }
          }
          if (ok && content && content.trim().length) {
            await fetch(`/api/messages/${messageId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ content }) }).catch(() => undefined);
          }
          setItems(prev => prev.map(p => p.status !== 'error' ? { ...p, status: ok ? 'done' : 'error', progress: ok ? 100 : p.progress, error: ok ? null : 'Error registrando adjuntos' } : p));
          onDone?.({ ok, messageId, createdAt, error: ok ? undefined : 'failed' });
          if (ok) { onMessageCreated?.({ messageId, createdAt, attachments: serverAttachments.length > 0 ? serverAttachments : uploaded }); onUploaded?.(); }
        } else {
          // upload-first (compat)
          for (let i = 0; i < initial.length; i++) {
            const it = initial[i];
            const f = it.file;
            if (f.size > maxBytes) { setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', error: 'Archivo > límite' } : p)); continue; }
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'uploading', progress: 10 } : p));
            const size = await getImageSize(f);
            const base = `${conversationId}/${Date.now()}_${makeId(6)}`;
            const path = `conversation/${base}/${sanitizeFilename(f.name)}`;
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, progress: 25 } : p));
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            const extToMime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
            const chosenMime = (f.type === '' ? 'application/octet-stream' : (f.type || extToMime[ext] || 'application/octet-stream'));
            const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, f, { contentType: chosenMime, upsert: false });
            if (upErr) { setItems(prev => prev.map(p => p.id === it.id ? { ...p, status: 'error', error: upErr.message, progress: 0 } : p)); continue; }
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, progress: 70, storagePath: path } : p));
            uploaded.push({ filename: f.name, mime_type: chosenMime, byte_size: f.size, storage_path: path, width: size?.width ?? null, height: size?.height ?? null });
          }
          if (uploaded.length > 0) {
            const res = await fetch(`/api/chat/send`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ conversationId, body: content ?? '', attachments: uploaded }) });
            const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: { id?: string; created_at?: string } };
            const ok = res.ok && json?.ok !== false;
            setItems(prev => prev.map(p => p.status !== 'error' ? { ...p, status: ok ? 'done' : 'error', progress: ok ? 100 : p.progress, error: ok ? null : 'No se pudo crear el mensaje' } : p));
            const msgId = json?.data?.id ? String(json.data.id) : null;
            const createdAt = json?.data?.created_at ? String(json.data?.created_at) : null;
            onDone?.({ ok, messageId: msgId, createdAt, error: ok ? undefined : 'failed' });
            if (ok && msgId) { onMessageCreated?.({ messageId: msgId, createdAt, attachments: uploaded }); onUploaded?.(); }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "upload_failed";
        setItems((prev) => prev.map((p) => (p.status === "idle" || p.status === "uploading" ? { ...p, status: "error", error: msg } : p)));
        onDone?.({ ok: false, error: msg });
      } finally {
        setBusy(false);
      }
    },
    [conversationId, content, maxBytes, maxFiles, onDone, onUploaded, onMessageCreated, supabase, mode],
  );

  const onFileChange = React.useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      void handleFiles(e.target.files);
      // allow re-selecting the same file name
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFiles],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          onClick={onPick}
          disabled={disabled || busy}
        >
          Subir archivo
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          onChange={onFileChange}
          disabled={disabled || busy}
        />
      </div>
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1 truncate">{it.file.name}</div>
              <div className="w-40">
                <div className="h-2 bg-muted rounded">
                  <div
                    className={`h-2 rounded ${it.status === "error" ? "bg-red-500" : "bg-primary"}`}
                    style={{ width: `${Math.max(0, Math.min(100, it.progress))}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">
                {it.status === "error" ? "Error" : `${Math.round(it.progress)}%`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
