/* eslint-disable no-control-regex */
export type ContactFinding = {
  kind: "email" | "phone" | "address";
  match: string;
  index: number;
};

type ScanResult = {
  sanitized: string;
  findings: ContactFinding[];
};

const EMAIL_PLACEHOLDER = "[bloqueado: email]";
const PHONE_PLACEHOLDER = "[bloqueado: telefono]";
const ADDRESS_PLACEHOLDER = "[bloqueado: direccion]";

function normalizeObfuscations(input: string): string {
  let output = input;
  const replacements: Array<[RegExp, string]> = [
    [/\s*\(at\)|\s*\[at\]|\s+arroba\s+/gi, "@"],
    [/\s*\(dot\)|\s*\[dot\]|\s+punto\s+/gi, "."],
    [/\s+guion\s+/gi, "-"],
  ];
  for (const [pattern, value] of replacements) {
    output = output.replace(pattern, value);
  }
  return output.replace(/\u200B|\u200C|\u200D|\uFEFF/g, "");
}

const EMAIL_RX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function detectEmails(text: string): ContactFinding[] {
  const findings: ContactFinding[] = [];
  let match: RegExpExecArray | null;
  EMAIL_RX.lastIndex = 0;
  while ((match = EMAIL_RX.exec(text)) !== null) {
    findings.push({ kind: "email", match: match[0], index: match.index });
  }
  return findings;
}

function detectPhones(text: string): ContactFinding[] {
  const findings: ContactFinding[] = [];
  let buffer = "";
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\d/.test(ch)) {
      if (start === -1) start = i;
      buffer += ch;
      continue;
    }
    if (/[()\s.+-]/.test(ch)) {
      continue;
    }
    if (buffer.length >= 10 && buffer.length <= 14) {
      findings.push({ kind: "phone", match: text.slice(start, i), index: start });
    }
    buffer = "";
    start = -1;
  }
  if (buffer.length >= 10 && buffer.length <= 14) {
    findings.push({ kind: "phone", match: text.slice(start), index: start === -1 ? 0 : start });
  }
  return findings;
}

const ADDRESS_KEYWORDS = [
  "calle",
  "avenida",
  "colonia",
  "municipio",
  "alcaldia",
  "estado",
  "codigo postal",
  "cp",
  "col.",
  "mz",
  "lt",
  "numero",
];

function detectAddresses(text: string): ContactFinding[] {
  const lowered = text.toLowerCase();
  for (const keyword of ADDRESS_KEYWORDS) {
    const idx = lowered.indexOf(keyword);
    if (idx !== -1) {
      return [{ kind: "address", match: keyword, index: idx }];
    }
  }
  const zip = lowered.match(/\b\d{5}\b/);
  if (zip && zip.index !== undefined) {
    return [{ kind: "address", match: zip[0], index: zip.index }];
  }
  return [];
}

export function scanContact(input: string): ScanResult {
  const sanitized = normalizeObfuscations(input);
  const findings = [...detectEmails(sanitized), ...detectPhones(sanitized), ...detectAddresses(sanitized)];
  return { sanitized, findings };
}

export function redactContact(input: string): ScanResult {
  const { sanitized, findings } = scanContact(input);
  let redacted = sanitized;
  for (const finding of findings) {
    const placeholder =
      finding.kind === "email"
        ? EMAIL_PLACEHOLDER
        : finding.kind === "phone"
          ? PHONE_PLACEHOLDER
          : ADDRESS_PLACEHOLDER;
    redacted = redacted.replace(finding.match, placeholder);
  }
  return { sanitized: redacted, findings };
}
