export default function LoadingMensajeDetail() {
  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="h-5 w-40 rounded bg-slate-200 animate-pulse mb-3" />
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <aside className="rounded border bg-white overflow-hidden hidden md:block">
          <div className="p-3 border-b sticky top-0 bg-white z-10">
            <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
            <div className="mt-2 h-8 w-full bg-slate-100 rounded animate-pulse" />
          </div>
          <ul className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={i} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-slate-200 animate-pulse" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                    <div className="mt-2 h-3 w-56 bg-slate-100 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <main className="min-h-[50vh] rounded border bg-white overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="border-b p-3 flex items-center gap-3">
              <div className="size-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="mt-1 h-3 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
              {Array.from({ length: 8 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[70%] rounded-2xl px-3 py-2 bg-slate-100 animate-pulse">
                    <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-2">
              <div className="h-9 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

