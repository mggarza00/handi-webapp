import Link from "next/link";

export default function MyRequests() {
  // Secciones Activa / Cerrada como en Glide
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Solicitudes de Servicio</h2>
      <input placeholder="Search" className="w-full rounded-xl border px-3 py-2 border-neutral-300 dark:border-neutral-800" />
      <div className="space-y-3">
        <div className="text-xs font-semibold text-neutral-500">Activa</div>
        {/* Cards de ejemplo */}
        <div className="rounded-2xl border p-4">
          <div className="text-xs font-semibold tracking-wide text-neutral-500">MANTENIMIENTO</div>
          <div className="font-medium">Mantenimiento en casa 3</div>
          <div className="text-sm text-neutral-500">2025-06-25</div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold text-neutral-500">Cerrada</div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs font-semibold tracking-wide text-neutral-500">PLOMERÍA</div>
          <div className="font-medium">Plomería en casa 4</div>
          <div className="text-sm text-neutral-500">2025-06-23</div>
        </div>
      </div>
      <div className="pt-2">
        <Link href="/requests/new" className="inline-flex h-10 items-center justify-center rounded-2xl px-4 border border-neutral-300 dark:border-neutral-800">
          Crear nueva solicitud
        </Link>
      </div>
    </div>
  );
}
