"use client";

export default function AdminActions({
  id,
  status,
}: {
  id: string;
  status: string | null;
}) {
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
        onClick={() => void send("accepted")}
        className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50"
        disabled={status === "accepted"}
      >
        Aprobar
      </button>
      <button
        onClick={() => void send("rejected")}
        className="rounded bg-rose-600 px-3 py-1 text-white disabled:opacity-50"
        disabled={status === "rejected"}
      >
        Rechazar
      </button>
      <button
        onClick={() => void send("pending")}
        className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
        disabled={!status || status === "pending"}
      >
        Reabrir
      </button>
    </div>
  );
}
