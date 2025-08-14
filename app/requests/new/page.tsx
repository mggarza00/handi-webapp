// app/requests/new/page.tsx
"use client";

import React, { useMemo, useState } from "react";

type Option = { value: string; label: string };

const CATEGORIES: Record<string, string[]> = {
  "Construcción y Remodelación": ["Albañilería", "Plomería", "Electricidad"],
  "Mantenimiento del Hogar": ["Pintura", "Carpintería", "Yeso y tablaroca"],
  Instalaciones: ["Aire acondicionado", "CCTV", "Cercas y portones"],
};

export default function NewRequestPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Monterrey");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [requiredAt, setRequiredAt] = useState("");

  const subcatOptions: Option[] = useMemo(() => {
    const list = CATEGORIES[category] ?? [];
    return list.map((s) => ({ value: s, label: s }));
  }, [category]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      title,
      description,
      city,
      category,
      subcategory,
      budget: budget === "" ? null : Number(budget),
      required_at: requiredAt,
      status: "active",
      created_by: "demo-user-1", // TODO: cambia por el userId real si ya tienes auth
    };

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(data);
      alert(`Error: ${data.error || "No fue posible guardar la solicitud"}`);
      return;
    }
    alert("Solicitud creada");
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Nueva solicitud</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Título</label>
          <input
            className="w-full rounded border p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Necesito plomero"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea
            className="w-full rounded border p-2"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe lo que necesitas…"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Ciudad</label>
            <input
              className="w-full rounded border p-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Monterrey"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Presupuesto (MXN)</label>
            <input
              type="number"
              className="w-full rounded border p-2"
              value={budget}
              onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              step={100}
              placeholder="1200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Categoría</label>
            <select
              className="w-full rounded border p-2"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {Object.keys(CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subcategoría</label>
            <select
              className="w-full rounded border p-2"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              required
              disabled={!category}
            >
              <option value="" disabled>
                {category ? "Selecciona…" : "Elige una categoría primero"}
              </option>
              {subcatOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Fecha requerida</label>
          <input
            type="date"
            className="w-full rounded border p-2"
            value={requiredAt}
            onChange={(e) => setRequiredAt(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2"
        >
          Publicar solicitud
        </button>
      </form>
    </main>
  );
}
