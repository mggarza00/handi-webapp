"use client";
import { useEffect } from "react";
import { toast } from "sonner";

export default function ToastOnMount({
  message,
  type = "success",
}: {
  message: string;
  type?: "success" | "error" | "info";
}) {
  useEffect(() => {
    if (type === "error") toast.error(message);
    else if (type === "info") toast.message(message);
    else toast.success(message);
  }, [message, type]);
  return null;
}
