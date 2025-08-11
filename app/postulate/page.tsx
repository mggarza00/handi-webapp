'use client'

import React, { useEffect, useState } from 'react'
import { Check, Circle, Loader2 } from 'lucide-react'

/**
 * Handee – /app/postulate/page.tsx (versión MVP con userId desde localStorage)
 *
 * ✅ Incluye:
 * - Header estilo Handee
 * - Sidebar con cambio rápido de rol (deshabilitado si no está aprobado)
 * - Pasos de progreso, requisitos, estado y CTAs
 * - Diseño móvil‑first y responsivo
 * - Handlers conectados a endpoints con "guard" si no hay userId
 *
 * 🧠 ¿De dónde sale el userId?
 *   Guardamos el ID del usuario en localStorage bajo la clave "handee_uid".
 *   Ejemplo para pruebas en consola del navegador:
 *     localStorage.setItem('handee_uid', 'demo-user-1')
 *   Ese valor debe existir en la columna user_id de tu hoja "Usuarios".
 */

const steps = [
  'Cuenta',
  'Datos',
  'Categorías',
  'Ubicación',
  'Referencias',
  'Carta',
  'Identificación',
  'Revisión',
]

export default function PostulatePage() {
  // userId desde localStorage (MVP sin autenticación)
  const [userId, setUserId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false) // para no ejecutar llamadas antes de leer localStorage

  const [role, setRole] = useState<'cliente' | 'profesional'>('cliente')
  const [allowedRoles, setAllowedRoles] = useState<Array<'cliente' | 'profesional'>>(['cliente'])
  const [status, setStatus] = useState<'no_iniciado' | 'en_proceso' | 'enviado' | 'aprobado' | 'rechazado'>('no_iniciado')
  const [activeStep, setActiveStep] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const canUseProfessional = allowedRoles.includes('profesional')

  // 1) Hidratar userId desde localStorage una sola vez
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('handee_uid') : null
    if (stored) setUserId(stored)
    setHydrated(true)
  }, [])

  // Helper para fetch JSON con manejo de errores básicos
  async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const r = await fetch(input, init)
    if (!r.ok) throw new Error(await r.text())
    return r.json() as Promise<T>
  }

  // 2) Cargar rol y estado de postulación cuando tengamos userId
  useEffect(() => {
    if (!hydrated || !userId) return
    let cancelled = false
    ;(async () => {
      try {
        // Cargar datos de usuario (roles_permitidos, rol_actual)
        const user = await fetchJSON<{ ok: boolean; user: { rol_actual?: string; roles_permitidos?: string } }>(`/api/users/${userId}`)
        if (!cancelled && user?.ok) {
          const roles = (user.user.roles_permitidos || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean) as Array<'cliente' | 'profesional'>
          setAllowedRoles(roles.length ? roles : ['cliente'])
          setRole(user.user.rol_actual === 'profesional' ? 'profesional' : 'cliente')
        }
      } catch {
        // Usuario no encontrado o endpoint aún no implementado
      }

      try {
        // Cargar estado de postulación
        const app = await fetchJSON<{ ok: boolean; status: string; step: number }>(`/api/professionals/applications?userId=${userId}`)
        if (!cancelled && app?.ok) {
          setStatus((app.status as any) || 'no_iniciado')
          setActiveStep(Number(app.step || 0))
        }
      } catch {
        // Aún no ha iniciado postulación
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated, userId])

  // --- Handlers (cada uno con guard: si no hay userId, salir) ---
  async function startApplication() {
    if (!userId) return // ⛔ guard
    setLoading(true)
    try {
      const data = await fetchJSON<{ ok: boolean; status: any; step: number }>(`/api/professionals/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setStatus((data.status as any) || 'en_proceso')
      setActiveStep(Number(data.step || 1))
    } finally {
      setLoading(false)
    }
  }

  async function continueApplication() {
    if (!userId) return // ⛔ guard
    setLoading(true)
    try {
      const data = await fetchJSON<{ ok: boolean; status: any; step: number }>(`/api/professionals/applications?userId=${userId}`)
      setStatus((data.status as any) || 'en_proceso')
      setActiveStep(Number(data.step || 1))
    } finally {
      setLoading(false)
    }
  }

  async function viewSubmissionStatus() {
    await continueApplication()
  }

  async function handleQuickRoleSwitch() {
    if (!userId) return // ⛔ guard

    if (!canUseProfessional) {
      document.getElementById('banner')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const newRole = role === 'cliente' ? 'profesional' : 'cliente'
    setLoading(true)
    try {
      await fetchJSON(`/api/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole }),
      })
      setRole(newRole)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 shadow-sm" style={{ backgroundColor: '#0e2c35' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button aria-label="Abrir menú" className="rounded-xl p-2 hover:bg-white/10 focus:outline-none">
              <span className="i-lucide-menu" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-amber-400" />
              <span className="text-xl font-bold tracking-tight text-white">Handee</span>
            </div>
          </div>

          {/* Toggle de rol (opcional en header; oficial en sidebar) */}
          <button
            onClick={handleQuickRoleSwitch}
            className="hidden rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur hover:bg-white/20 md:block"
            title={
              canUseProfessional
                ? role === 'cliente'
                  ? 'Cambiar a modo Profesional'
                  : 'Cambiar a modo Cliente'
                : 'Postúlate para activar el modo Profesional'
            }
            disabled={loading || !userId}
          >
            {canUseProfessional ? (role === 'cliente' ? 'Cambiar a Profesional' : 'Cambiar a Cliente') : 'Postúlate para ser Profesional'}
          </button>
        </div>
      </header>

      {/* LAYOUT */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[280px,1fr]">
        {/* SIDEBAR */}
        <aside className="order-2 h-max rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:order-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div>
              <p className="text-sm font-semibold">Mauricio Garza</p>
              <p className="text-xs text-slate-500">Rol actual: {role === 'cliente' ? 'Cliente' : 'Profesional'}</p>
            </div>
          </div>

          <div className="my-4 h-px w-full bg-slate-200" />

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Cambio rápido de rol</p>
            <button
              onClick={handleQuickRoleSwitch}
              className={`w-full rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition ${
                canUseProfessional ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-500'
              }`}
              disabled={!canUseProfessional || loading || !userId}
            >
              {canUseProfessional
                ? role === 'cliente'
                  ? 'Cambiar a modo Profesional'
                  : 'Cambiar a modo Cliente'
                : 'Postúlate para activar modo Profesional'}
            </button>
            {!canUseProfessional && (
              <p className="text-xs text-slate-500">Completa tu postulación para usar el modo Profesional.</p>
            )}
          </div>

          <div className="my-4 h-px w-full bg-slate-200" />

          <nav className="space-y-1 text-sm">
            <a className="block rounded-lg px-3 py-2 hover:bg-slate-50">Inicio</a>
            <a className="block rounded-lg px-3 py-2 hover:bg-slate-50">Mis solicitudes</a>
            <a className="block rounded-lg px-3 py-2 hover:bg-slate-50">Favoritos</a>
            <a className="block rounded-lg px-3 py-2 hover:bg-slate-50">Configuración</a>
          </nav>
        </aside>

        {/* MAIN */}
        <main className="order-1 space-y-6 md:order-2">
          {/* Banner */}
          <section id="banner" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-bold tracking-tight">Postúlate como Profesional</h1>
            <p className="mt-1 text-sm text-slate-600">Para ofrecer tus servicios en Handee, completa tu perfil y envíalo a validación.</p>

            {/* Pasos */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {steps.map((label, idx) => {
                const done = idx < activeStep
                const current = idx === activeStep
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      done
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : current
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : current ? (
                      <Circle className="h-4 w-4" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                    )}
                    <span className="truncate">{idx + 1}. {label}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Requisitos + Estado */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,360px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Requisitos</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>• Datos personales y foto de perfil</li>
                <li>• Selecciona tus categorías y subcategorías</li>
                <li>• Zona de servicio (ciudad y radio)</li>
                <li>• 3 referencias laborales con contacto</li>
                <li>• Al menos 1 carta de recomendación firmada (PDF/JPG)</li>
                <li>• Identificación oficial (INE o pasaporte)</li>
                <li>• Aceptar términos, aviso de privacidad y política de reseñas</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Estado</h2>
              <div className="mt-3 space-y-1 text-sm">
                <p>Rol actual: <b>{role === 'cliente' ? 'Cliente' : 'Profesional'}</b></p>
                <p>
                  Profesional: <b className={status === 'aprobado' ? 'text-emerald-600' : 'text-rose-600'}>
                    {status === 'aprobado' ? 'Aprobado' : 'No aprobado'}
                  </b>
                </p>
                {status === 'enviado' && <p className="text-slate-600">Tu postulación está <b>pendiente de revisión</b>.</p>}
                {status === 'en_proceso' && <p className="text-slate-600">Borrador guardado. Puedes continuar cuando gustes.</p>}
              </div>
            </div>
          </section>

          {/* Secciones del formulario */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Vista previa de secciones</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                'Datos personales',
                'Categorías & Subcategorías',
                'Ubicación & Radio',
                'Referencias (3)',
                'Carta de recomendación',
                'Identificación oficial',
              ].map((t) => (
                <div key={t} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="mt-1 text-xs text-slate-500">— Completa y guarda</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTAs */}
          <section className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={startApplication}
              className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              disabled={loading || !userId}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Comenzar postulación
            </button>

            <button
              onClick={continueApplication}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              disabled={loading || !userId}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continuar donde me quedé
            </button>

            <button
              onClick={viewSubmissionStatus}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              disabled={loading || !userId}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ya envié: Ver estado
            </button>
          </section>

          <p className="text-xs text-slate-500">Al enviar tu postulación, validaremos referencias y documentos. Te notificaremos por email y WhatsApp.</p>
        </main>
      </div>
    </div>
  )
}
