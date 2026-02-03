"use client";

type Props = {
  id: string;
  status: string | null;
  onToggleView?: (id: string) => void;
  isExpanded?: boolean;
};

export default function AdminActions({
  id,
  status,
  onToggleView,
  isExpanded,
}: Props) {
  async function send(newStatus: "accepted" | "rejected" | "pending") {
    const res = await fetch(`/api/admin/pro-applications/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ status: newStatus }),
      cache: "no-store",
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const t = await res.text();
      alert(`Error: ${t}`);
    }
  }
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => void send("accepted")}
        className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50"
        disabled={status === "accepted"}
      >
        Aprobar
      </button>
      <button
        type="button"
        onClick={() => void send("rejected")}
        className="rounded bg-rose-600 px-3 py-1 text-white disabled:opacity-50"
        disabled={status === "rejected"}
      >
        Rechazar
      </button>
      <button
        type="button"
        onClick={() => onToggleView?.(id)}
        className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
        aria-expanded={isExpanded}
        disabled={!onToggleView}
      >
        Ver
      </button>
    </div>
  );
}
