export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="h-20 animate-pulse rounded bg-slate-100" />
        <div className="h-20 animate-pulse rounded bg-slate-100" />
        <div className="h-20 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-6 h-32 animate-pulse rounded bg-slate-100" />
      <div className="mt-6 h-48 animate-pulse rounded bg-slate-100" />
    </main>
  );
}
