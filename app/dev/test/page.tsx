// app/dev/test/page.tsx
"use client";
import { useEffect, useState } from "react";

type ApiRes<T=any> = { ok: boolean; data?: T; error?: string; page?: number; limit?: number };

export default function TestPage() {
  const [last, setLast] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [requestIdInput, setRequestIdInput] = useState("");
  const [latestRequestId, setLatestRequestId] = useState<string | null>(null);

  async function call<T=any>(url: string, options?: RequestInit) {
    setLoading(url);
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json; charset=utf-8", ...(options?.headers || {}) },
      });
      const json = await res.json();
      setLast(json);
      return json as ApiRes<T>;
    } catch (e:any) {
      const err = { ok:false, error: e?.message || "NETWORK_ERROR" };
      setLast(err);
      return err as any;
    } finally {
      setLoading(null);
    }
  }

  async function crearSolicitud() {
    const body = {
      title: "Necesito plomero",
      description: "Fuga en cocina bajo la tarja",
      city: "Monterrey",
      category: "Construcción y Remodelación",
      subcategory: "Plomería",
      budget: 1200,
      requiredAt: new Date().toISOString(),
    };
    const r = await call("/api/requests", { method: "POST", body: JSON.stringify(body) });
    const id = (r as any)?.data?.id;
    if (id) setLatestRequestId(id);
  }

  async function crearProfesional() {
    const body = {
      headline: "Plomero certificado",
      skills: ["Instalaciones", "Detección de fugas"],
    };
    await call("/api/professionals", { method: "POST", body: JSON.stringify(body) });
  }

  async function listarSolicitudes() {
    const r = await call<{ id:string }[]>("/api/requests?limit=10&page=1");
    const first = (r as any)?.data?.[0];
    if (first?.id) setLatestRequestId(first.id);
  }

  async function postularALaUltima() {
    if (!latestRequestId) {
      setLast({ ok:false, error:"NO_LATEST_REQUEST_ID" });
      return;
    }
    const body = {
      requestId: latestRequestId,
      coverLetter: "Puedo pasar hoy por la tarde.",
      proposedBudget: 1300,
    };
    await call("/api/applications", { method: "POST", body: JSON.stringify(body) });
  }

  async function postularConIdPegado() {
    if (!requestIdInput) {
      setLast({ ok:false, error:"MISSING_REQUEST_ID_INPUT" });
      return;
    }
    const body = {
      requestId: requestIdInput.trim(),
      coverLetter: "Disponible mañana 9am.",
      proposedBudget: 1400,
    };
    await call("/api/applications", { method: "POST", body: JSON.stringify(body) });
  }

  useEffect(() => {
    // Carga inicial del listado para capturar un requestId si existe
    listarSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-semibold">Pruebas API Handee</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={crearSolicitud} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!!loading}>
          {loading==="/api/requests" ? "Creando solicitud..." : "Crear solicitud"}
        </button>

        <button onClick={crearProfesional} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!!loading}>
          {loading==="/api/professionals" ? "Guardando profesional..." : "Crear/actualizar profesional"}
        </button>

        <button onClick={listarSolicitudes} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!!loading}>
          {loading?.startsWith("/api/requests") ? "Listando..." : "Listar solicitudes (activas)"}
        </button>

        <button onClick={postularALaUltima} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!!loading}>
          {loading==="/api/applications" ? "Postulando..." : "Postularme a la última solicitud"}
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Postularme con Request ID específico</label>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Pega aquí el UUID de la solicitud"
            value={requestIdInput}
            onChange={(e)=>setRequestIdInput(e.target.value)}
          />
          <button onClick={postularConIdPegado} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!!loading}>
            {loading==="/api/applications" ? "Postulando..." : "Postular"}
          </button>
        </div>
        <p className="text-sm text-gray-600">Último requestId detectado: <span className="font-mono">{latestRequestId ?? "N/A"}</span></p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-1">Última respuesta</h2>
        <pre className="bg-gray-100 p-3 rounded overflow-auto text-sm">{JSON.stringify(last, null, 2)}</pre>
      </div>
    </div>
  );
}
