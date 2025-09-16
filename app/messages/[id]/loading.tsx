export default function LoadingConversation() {
  return (
    <div className="mx-auto max-w-3xl h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)] p-4">
      <div className="h-full rounded border bg-white overflow-hidden flex flex-col">
        <div className="border-b p-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
            <div className="mt-1 h-3 w-40 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
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
    </div>
  );
}

