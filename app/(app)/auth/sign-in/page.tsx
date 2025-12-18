"use client";

import { SignInFlowCard } from "@/components/auth/SignInFlow.client";
import HideHeaderLoginButtons from "@/components/auth/HideHeaderLoginButtons.client";

export default function SignInPage() {
  return (
    <>
      <HideHeaderLoginButtons />
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-10">
        <SignInFlowCard variant="page" />
      </div>
    </>
  );
}
