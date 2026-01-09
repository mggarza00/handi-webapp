export default function LoadingMessages() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="h-5 w-40 rounded bg-slate-200 animate-pulse mb-3" />
      <ul className="divide-y rounded border bg-white">
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
    </div>
  );
}

