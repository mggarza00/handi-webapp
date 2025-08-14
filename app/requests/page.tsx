import { Suspense } from "react";
import RequestsClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequestsClient />
    </Suspense>
  );
}