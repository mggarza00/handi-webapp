"use client";
import { useState } from "react";

export default function DevCreateRequest() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<any>(null);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          title: "Prueba con acentos – Plomería",
          description: "Cambio de mezcladora",
          city: "Monterrey",
          category: "Construcción y Remodelación",
          subcategory: "Plomería",
          budget: 1200,
          required_at: "2025-08-20"
        }),
      });
      const json = await res.json();
      setResp(json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-3">
      <h1 className="text-xl font-semibold">Crear solicitud de prueba</h1>
      <button disabled={loading} onClick={create} className="border rounded px-4 py-2">
        {loading ? "Enviando..." : "Crear"}
      </button>
      <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
        {resp ? JSON.stringify(resp, null, 2) : "Sin respuesta aún"}
      </pre>
    </div>
  );
}
