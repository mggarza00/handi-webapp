export type ConditionOption = { value: string; label: string };

// Sugerencias de condiciones comunes (orden y emojis según solicitud)
export const CONDITION_SUGGESTIONS: ConditionOption[] = [
  { value: "Trabajos en altura", label: "🧗 Trabajos en altura" },
  { value: "Requiere herramienta especial", label: "🧰 Requiere herramienta especial" },
  { value: "Trabajo especializado", label: "🧠 Trabajo especializado" },
  { value: "Requiere certificación", label: "📜 Requiere certificación" },
  { value: "Trabajo en exterior", label: "🌤 Trabajo en exterior" },
  { value: "Espacio reducido", label: "📦 Espacio reducido" },
  { value: "Acceso restringido", label: "🚧 Acceso restringido" },
  { value: "Horario nocturno", label: "🌙 Horario nocturno" },
  { value: "Trabajo con electricidad", label: "⚡ Trabajo con electricidad" },
  { value: "Trabajo con agua/gas", label: "💧 Trabajo con agua/gas" },
  { value: "Cargas pesadas", label: "🏋 Cargas pesadas" },
  { value: "Trabajo urgente", label: "⏱ Trabajo urgente" },
  { value: "Material lo aporta el cliente", label: "📦 Material lo aporta el cliente" },
  { value: "Transporte adicional", label: "🚚 Transporte adicional" },
  { value: "Zona de riesgo / seguridad", label: "🛡 Zona de riesgo / seguridad" },
  { value: "Retiro de escombros", label: "🧱 Retiro de escombros" },
  { value: "Domicilio habitado (personas/mascotas)", label: "🏠 Domicilio habitado (personas/mascotas)" },
  { value: "Ambiente controlado (higiene/food-safe)", label: "🧼 Ambiente controlado (higiene/food-safe)" },
  { value: "Poca señal / sin internet", label: "🛰 Poca señal / sin internet" },
  { value: "Andamios / escaleras requeridos", label: "🪜 Andamios / escaleras requeridos" },
];

// Utilidad para mostrar en UI con Title Case, sin modificar el valor persistido
export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

export function mapConditionToLabel(value: string): string {
  const v = value.trim();
  const found = CONDITION_SUGGESTIONS.find(
    (o) => o.value.toLowerCase() === v.toLowerCase(),
  );
  if (found) return found.label;
  return toTitleCase(v);
}
