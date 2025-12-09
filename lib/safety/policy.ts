export type ContactPolicy = "block" | "redact" | "ignore";

function resolveContactPolicy(): ContactPolicy {
  const raw = (process.env.NEXT_PUBLIC_CONTACT_POLICY ?? "block").toLowerCase();
  if (raw === "redact") return "redact";
  if (raw === "ignore") return "ignore";
  return "block";
}

function resolveContactPolicyMode(): "off" | "block" | "redact" {
  const raw = (process.env.NEXT_PUBLIC_CONTACT_POLICY_MODE ?? "redact").toLowerCase();
  if (raw === "off") return "off";
  if (raw === "block") return "block";
  return "redact";
}

function resolveContactPolicyMessage(): string {
  return (
    process.env.NEXT_PUBLIC_CONTACT_POLICY_MESSAGE ??
    "Por seguridad, evita compartir telefono, correo o direccion. Usa la oferta dentro de Handi para coordinar."
  );
}

export function getContactPolicy(): ContactPolicy {
  return resolveContactPolicy();
}

export function getContactPolicyMode(): "off" | "block" | "redact" {
  return resolveContactPolicyMode();
}

export function getContactPolicyMessage(): string {
  return resolveContactPolicyMessage();
}
