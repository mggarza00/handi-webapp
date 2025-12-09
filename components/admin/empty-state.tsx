export default function EmptyState({ title = "Sin resultados", description = "Ajusta filtros o crea un nuevo registro." }: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border p-8 text-center text-muted-foreground">
      <div className="text-base font-medium text-foreground">{title}</div>
      <div className="mt-1 text-sm">{description}</div>
    </div>
  );
}

