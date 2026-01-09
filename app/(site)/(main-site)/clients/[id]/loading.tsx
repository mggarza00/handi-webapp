import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingClientProfile() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="h-4 w-36 rounded bg-slate-200" />

      <Card>
        <CardHeader className="flex items-center gap-4">
          <div className="h-[72px] w-[72px] rounded-full bg-slate-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <CardTitle className="h-6 w-48 rounded bg-slate-200" />
            <div className="h-4 w-40 rounded bg-slate-200" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="h-4 w-28 rounded bg-slate-200" />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="h-5 w-44 rounded bg-slate-200" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded border bg-white">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-64 rounded bg-slate-200" />
                <div className="h-5 w-20 rounded-full bg-slate-200" />
              </div>
              <div className="h-4 w-full rounded bg-slate-200" />
              <div className="h-4 w-3/5 rounded bg-slate-200" />
              <div className="h-3 w-32 rounded bg-slate-200" />
            </div>
            <div className="border-t bg-slate-50 p-4 space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="h-5 w-40 rounded bg-slate-200" />
        {[0, 1].map((i) => (
          <div key={i} className="h-12 w-full rounded bg-slate-200" />
        ))}
      </section>
    </main>
  );
}

