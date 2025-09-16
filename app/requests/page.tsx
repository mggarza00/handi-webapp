import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const RequestsClient = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => null,
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