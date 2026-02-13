import { getContactPolicyMessage } from "./policy";

export type Finding = {
  kind: "phone" | "email" | "url" | "address";
  value: string;
};
export type ContactScan = { sanitized: string; findings: Finding[] };
export type ScanResult = ContactScan & {
  hasContact: boolean;
  reason: string | null;
};

/* ---- Normalización mínima ---- */
function normalizeObfuscations(text: string): string {
  // quita NBSP, baja a min�sculas y normaliza obfuscaciones comunes
  let out = text
    .replace(/\u00A0/g, " ")
    .toLowerCase()
    .trim();
  const replacements: Array<[RegExp, string]> = [
    [/cero/g, "0"],
    [/uno/g, "1"],
    [/una/g, "1"],
    [/dos/g, "2"],
    [/tres/g, "3"],
    [/cuatro/g, "4"],
    [/cinco/g, "5"],
    [/seis/g, "6"],
    [/siete/g, "7"],
    [/ocho/g, "8"],
    [/nueve/g, "9"],
    [/diez/g, "10"],
    [/once/g, "11"],
    [/doce/g, "12"],
    [/trece/g, "13"],
    [/catorce/g, "14"],
    [/quince/g, "15"],
  ];
  for (const [re, value] of replacements) {
    out = out.replace(re, value);
  }
  out = out.replace(/[\s._-]+/g, " ").trim();
  return out;
}

/* ---- Detectores ---- */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g; // 9-15 d�gitos con separadores
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
const ADDRESS_RE =
  /\b(?:calle|av(?:\.|enida)?|avenida|blvd|boulevard|col(?:\.|onia)?|fracc(?:\.|ionamiento)?|privada|circuito|carretera|km|n[u�]mero|no\.|#|int\.?|interior|ext\.?|exterior|cp|c\.p\.|codigo postal)\b[^\n]{0,40}\d{1,6}/gi;
const ADDRESS_WORD_RE =
  /\b(?:col(?:\.|onia)?|fracc(?:\.|ionamiento)?)\b[^\n]{0,40}\b[a-z������]{3,}\b/gi;

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
  const normalized = normalizeObfuscations(input);
  let m: RegExpExecArray | null;
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(normalized))) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 15) {
      out.push({ kind: "phone", value: m[0] });
    }
  }
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
  ADDRESS_WORD_RE.lastIndex = 0;
  while ((m = ADDRESS_WORD_RE.exec(s)))
    out.push({ kind: "address", value: m[0] });
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

  if (base.findings.some((f) => f.kind === "email")) {
    redacted = redacted.replace(EMAIL_RE, "[bloqueado: email]");
  }
  if (base.findings.some((f) => f.kind === "phone")) {
    redacted = redacted.replace(PHONE_RE, "[bloqueado: telefono]");
  }
  if (base.findings.some((f) => f.kind === "url")) {
    redacted = redacted.replace(URL_RE, "[bloqueado: url]");
  }
  if (base.findings.some((f) => f.kind === "address")) {
    redacted = redacted.replace(ADDRESS_RE, "[bloqueado: direccion]");
    redacted = redacted.replace(ADDRESS_WORD_RE, "[bloqueado: direccion]");
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
