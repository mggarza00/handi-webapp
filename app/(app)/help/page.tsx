export default function Help() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-semibold">Centro de ayuda</h2>
      <p className="text-neutral-600 dark:text-neutral-300">
        ¿Tienes dudas? Escríbenos o revisa nuestras preguntas frecuentes.
      </p>
      <ul className="space-y-2 text-sm">
        <li className="rounded-xl border p-3">¿Cómo crear una solicitud?</li>
        <li className="rounded-xl border p-3">¿Cómo postularme a un trabajo?</li>
        <li className="rounded-xl border p-3">Pagos destacados y reseñas</li>
      </ul>
    </div>
  );
}
