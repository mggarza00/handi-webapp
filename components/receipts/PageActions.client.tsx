"use client";
import * as React from 'react';
import { toast } from 'sonner';

export default function PageActions({ id }: { id: string }) {
  const onPrint = React.useCallback(() => { try { window.print(); } catch {} }, []);
  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('URL copiada');
    } catch { toast.error('No se pudo copiar'); }
  }, []);
  const onEmail = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/receipts/${encodeURIComponent(id)}/email`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'No se pudo enviar');
      toast.success('Email enviado');
    } catch (e) { toast.error((e as Error).message || 'No se pudo enviar'); }
  }, [id]);
  return (
    <div className="print:hidden flex gap-2 justify-end">
      <button onClick={onPrint} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50">Imprimir</button>
      <a href={`/api/receipts/${encodeURIComponent(id)}/pdf`} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50">Descargar PDF</a>
      <button onClick={onEmail} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50">Enviar por correo</button>
      <button onClick={onCopy} className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50">Copiar URL</button>
    </div>
  );
}

