import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function RequestsLoadingFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-6">
      <div className="h-8 w-52 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3">
        <div className="h-28 animate-pulse rounded-2xl border bg-slate-100" />
        <div className="h-28 animate-pulse rounded-2xl border bg-slate-100" />
        <div className="h-28 animate-pulse rounded-2xl border bg-slate-100" />
      </div>
    </div>
  );
}

const RequestsClient = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => <RequestsLoadingFallback />,
});

export default function Page({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const mine = (searchParams?.mine ?? "").toString();
  if (mine !== "1" && mine.toLowerCase() !== "true") {
    redirect("/requests?mine=1");
  }
  // Client version handles the rest of the view/state.
  return <RequestsClient />;
}
