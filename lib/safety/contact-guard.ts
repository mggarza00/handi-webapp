import { getContactPolicyMessage } from "./policy";

export type Finding = { kind: "phone" | "email" | "url" | "address"; value: string };
export type ContactScan = { sanitized: string; findings: Finding[] };
export type ScanResult = ContactScan & { hasContact: boolean; reason: string | null };

/* ---- Normalización mínima ---- */
function normalizeObfuscations(text: string): string {
  // quita NBSP, trimming básico
  return text.replace(/\u00A0/g, " ").trim();
}

/* ---- Detectores ---- */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g; // simple: 9+ dígitos con separadores
const URL_RE   = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
// De momento no implementamos address real; placeholder:
const ADDRESS_RE = /(calle\s+\S+|\bcp\s*\d{5}\b)/gi;

export function detectEmails(input: string): Finding[] {
  const out: Finding[] = [];
  const s = input;
  let m: RegExpExecArray | null;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(s))) out.push({ kind: "email", value: m[0] });
  return out;
}

export function detectPhones(input: string): Finding[] {
  const out: Finding[] = [];
  const s = input;
  let m: RegExpExecArray | null;
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(s))) out.push({ kind: "phone", value: m[0] });
  return out;
}

export function detectUrls(input: string): Finding[] {
  const out: Finding[] = [];
  const s = input;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(s))) out.push({ kind: "url", value: m[0] });
  return out;
}

export function detectAddresses(input: string): Finding[] {
  const out: Finding[] = [];
  const s = input;
  let m: RegExpExecArray | null;
  ADDRESS_RE.lastIndex = 0;
  while ((m = ADDRESS_RE.exec(s))) out.push({ kind: "address", value: m[0] });
  return out;
}

/* ---- Escaneo (no redacción) ---- */
export function scanContact(input: string): ContactScan {
  const sanitized = normalizeObfuscations(input);
  const findings = [
    ...detectEmails(sanitized),
    ...detectPhones(sanitized),
    ...detectUrls(sanitized),
    ...detectAddresses(sanitized),
  ];
  return { sanitized, findings };
}

/* ---- Redacción (con placeholders en español, esperado por tests) ---- */
export function redactContact(input: string): ContactScan {
  const base = scanContact(input);
  let redacted = base.sanitized;

  if (base.findings.some(f => f.kind === "email")) {
    redacted = redacted.replace(EMAIL_RE, "[bloqueado: email]");
  }
  if (base.findings.some(f => f.kind === "phone")) {
    redacted = redacted.replace(PHONE_RE, "[bloqueado: telefono]");
  }
  if (base.findings.some(f => f.kind === "url")) {
    redacted = redacted.replace(URL_RE, "[bloqueado: url]");
  }
  if (base.findings.some(f => f.kind === "address")) {
    redacted = redacted.replace(ADDRESS_RE, "[bloqueado: direccion]");
  }

  return { sanitized: redacted, findings: base.findings };
}

/* ---- Resultado para UI (mensaje + política) ---- */
export function scanMessage(text: string): ScanResult {
  const contact = scanContact(text);
  const hasContact = contact.findings.length > 0;
  return {
    ...contact,
    hasContact,
    reason: hasContact ? getContactPolicyMessage() : null,
  };
}
