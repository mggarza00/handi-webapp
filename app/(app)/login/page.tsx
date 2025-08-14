import { Suspense } from "react";
import LoginClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}