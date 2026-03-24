"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { HOME_SIGN_IN_MODAL_OPEN_EVENT } from "@/lib/auth/home-sign-in-modal";

const HomeSignInModal = dynamic(() => import("./HomeSignInModal.client"), {
  ssr: false,
});

export default function HomeSignInModalHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(HOME_SIGN_IN_MODAL_OPEN_EVENT, onOpen);
    return () =>
      window.removeEventListener(HOME_SIGN_IN_MODAL_OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return <HomeSignInModal onClose={() => setOpen(false)} />;
}
