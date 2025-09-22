/* eslint-disable react/no-unescaped-entities */
// app/postulate/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type RequestRow = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number;
  required_at: string;
  status: "active" | "closed";
  created_by: string;
  created_at: string;
};

export default function PostulatePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Monterrey, N.L.");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [requiredAt, setRequiredAt] = useState("");

  // 1) Cargar userId desde localStorage (temporal)
  function reloadUserId() {
    const id = window.localStorage.getItem("handi_user_id") ?? window.localStorage.getItem("handee_user_id");
    setUserId(id);
  }
  useEffect(() => {
    reloadUserId();
  }, []);

  const canSubmit = useMemo(() => {
    return !!userId && title.trim() && category.trim() && subcategory.trim();
  }, [userId, title, category, subcategory]);

  async function handleSubmit() {
    setErrorMsg(null);
    setSubmitMsg(null);

    // Guard clause: si no hay userId, no hace nada
    if (!userId) {
      setErrorMsg(
        "Necesitas iniciar sesión. (Temporal: define handi_user_id en localStorage)",
      );
      return;
    }
    if (!title || !category || !subcategory) {
      setErrorMsg(
        "Faltan campos obligatorios (título, categoría y subcategoría).",
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        city,
        category,
        subcategory,
        budget,
        required_at: requiredAt, // ISO o texto libre
        status: "active",
        created_by: userId,
      };

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ApiResponse<RequestRow>;

      if ("ok" in json && json.ok) {
        setSubmitMsg("¡Tu solicitud fue creada!");
        // Limpiar formulario
        setTitle("");
        setDescription("");
        setCity("Monterrey, N.L.");
        setCategory("");
        setSubcategory("");
        setBudget(0);
        setRequiredAt("");
        toast("¡Solicitud enviada con éxito!", "success");
      } else {
        let msg = "Ocurrió un error al enviar tu solicitud.";
        if (json.error === "USER_NOT_FOUND") {
          msg =
            "No encontramos tu usuario en la hoja de 'Usuarios'. Verifica tu ID.";
        } else if (json.error === "MISSING_FIELDS") {
          msg = "Faltan campos obligatorios.";
        } else if (json.error === "MISSING_USER_ID") {
          msg = "Falta el ID de usuario.";
        } else if (Array.isArray(json.error)) {
          msg = json.error.join(", ");
        }
        setErrorMsg(msg);
        toast(msg, "error");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Error de red o servidor.");
      toast("Error de red o servidor.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Toast simple inline
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | null>(null);
  function toast(msg: string, type: "success" | "error") {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMsg(null);
      setToastType(null);
    }, 2500);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">
        Postúlate / Publica tu solicitud
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Llena los campos y envía. (Temporal) Para pruebas, define tu{" "}
        <code>handi_user_id</code> en <b>localStorage</b>.
      </p>

      {!userId && (
        <div className="p-3 rounded border text-sm mb-4 bg-yellow-50 border-yellow-300">
          <b>Sin sesión:</b> No se detectó <code>handee_user_id</code> en
          localStorage.
          <br />
          <span className="block my-2 text-xs text-gray-600">
            Abre la consola y ejecuta:
            <br />
            <code>localStorage.setItem('handi_user_id','user-123')</code> y
            recarga.
          </span>
          <button
            className="mt-2 px-3 py-1 rounded bg-yellow-400 text-black text-xs"
            onClick={reloadUserId}
            disabled={loading}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <label className="block text-sm mb-1">Título *</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Instalación eléctrica en cocina"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Descripción</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe lo que necesitas…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Ciudad</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Monterrey, N.L."
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Presupuesto (MXN)</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              placeholder="0"
              min={0}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Categoría *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Construcción y Remodelación"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Subcategoría *</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Electricidad residencial"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">
            Fecha requerida (texto o ISO)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            value={requiredAt}
            onChange={(e) => setRequiredAt(e.target.value)}
            placeholder="2025-08-20 o 'Esta semana'"
          />
        </div>

        <button
          onClick={userId ? handleSubmit : undefined}
          disabled={!canSubmit || loading || !userId}
          className={`px-4 py-2 rounded text-white ${!canSubmit || loading || !userId ? "bg-gray-400" : "bg-black"}`}
        >
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>

        {submitMsg && <div className="text-green-700 text-sm">{submitMsg}</div>}
        {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
        {toastMsg && (
          <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg z-50 text-white ${toastType === "success" ? "bg-green-600" : "bg-red-600"}`}
            style={{ minWidth: 200, textAlign: "center" }}
          >
            {toastMsg}
          </div>
        )}
      </div>
    </main>
  );
}
