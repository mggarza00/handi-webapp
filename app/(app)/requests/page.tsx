export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Solicitudes y vacantes</h2>
      <p className="text-neutral-600 dark:text-neutral-300">
        Aquí podrás ver todas las solicitudes de servicio y vacantes publicadas.
      </p>

      <div className="rounded-2xl border p-4">
        <div className="text-xs font-semibold tracking-wide text-neutral-500">
          Ejemplo
        </div>
        <div className="font-medium">Mantenimiento en casa 3</div>
        <div className="text-sm text-neutral-500">2025-06-25</div>
      </div>
    </div>
  );
}
