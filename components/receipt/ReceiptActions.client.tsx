"use client";
import * as React from 'react';
import { Button } from '@/components/ui/button';

export default function ReceiptActions({ onPrint }: { onPrint?: () => void }) {
  const handlePrint = React.useCallback(() => {
    try { window.print(); } catch { /* ignore */ }
    onPrint?.();
  }, [onPrint]);
  return (
    <div className="flex items-center justify-end gap-2 print:hidden">
      <Button variant="outline" onClick={handlePrint}>Imprimir / PDF</Button>
    </div>
  );
}

