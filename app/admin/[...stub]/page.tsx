export const dynamic = "force-dynamic";

export default function AdminStubPage({ params }: { params: { stub: string[] } }) {
  const path = "/admin/" + (params.stub?.join("/") || "");
  return (
    <div className="mx-auto max-w-2xl rounded-xl border p-6">
      <h1 className="text-xl font-semibold">{path}</h1>
      <p className="mt-2 text-sm text-muted-foreground">TODO: sección en construcción. Aquí irá la UI y lógica específica.</p>
    </div>
  );
}

