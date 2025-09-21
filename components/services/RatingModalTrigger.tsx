"use client";

import { useEffect, useState } from "react";

import RatingModal from "@/components/services/RatingModal";

type Props = {
  requestId: string;
  toUserId: string | null;
  viewerId: string | null;
  viewerRole: "pro" | "client";
  requestStatus: string | null;
  openOnMount?: boolean;
};

export default function RatingModalTrigger({
  requestId,
  toUserId,
  viewerId,
  viewerRole,
  requestStatus,
  openOnMount = false,
}: Props) {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const storageKey = viewerId ? `rated-${requestId}-${viewerId}` : null;

  useEffect(() => {
    if (
      !openOnMount ||
      requestStatus !== "completed" ||
      !toUserId ||
      !storageKey ||
      hasShown
    ) {
      return;
    }

    const alreadyRated =
      typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (!alreadyRated) {
      setShowRatingModal(true);
      setHasShown(true);
    }
  }, [openOnMount, requestStatus, storageKey, toUserId, hasShown]);

  const handleClose = () => {
    setShowRatingModal(false);
  };

  const handleSubmit = () => {
    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, "1");
    }
    setShowRatingModal(false);
    setHasShown(true);
  };

  if (!toUserId || !viewerId) return null;

  return (
    <RatingModal
      requestId={requestId}
      toUserId={toUserId}
      viewerRole={viewerRole}
      isOpen={showRatingModal}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
}




