import PageContainer from "@/components/page-container";

export default function Loading() {
  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="h-6 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="h-24 w-full bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-40 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    </PageContainer>
  );
}
