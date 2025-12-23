export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Acceso restringido</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Esta sección es exclusiva para el equipo de administradores de Handi. Si crees que deberías tener acceso,
        por favor contacta a un administrador.
      </p>
      <div className="mt-6 flex gap-3">
        <a href="/" className="rounded-md border px-3 py-2 text-sm">Ir al inicio</a>
        <a href="/auth/sign-in" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Iniciar sesión</a>
      </div>
    </main>
  );
}

