'use client'
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import CommandPalette from "@/components/command-palette";
import { useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Navbar onOpenCommand={() => setOpen(true)} />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
        <Sidebar />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
