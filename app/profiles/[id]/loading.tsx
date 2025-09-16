import PageContainer from "@/components/page-container";

export default function Loading() {
  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    </PageContainer>
  );
}
