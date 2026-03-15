import {
  ASSISTANT_SAFE_APP_LINKS,
  supportFallbackResponse,
} from "@/lib/assistant/intents";
import type { AssistantAction } from "@/types/assistant";

const MAX_SENTENCES = 4;

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const TECH_ROUTE_RE = /\/[a-z0-9-_]+(?:\/:[a-z0-9-_]+|\/[a-f0-9-]{8,})+/gi;
const APP_ROUTE_RE = /(^|\s)\/[a-z0-9][a-z0-9/_-]*/gi;
const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;

const SUPPORT_WA = "https://wa.me/528130878691";
const SUPPORT_MAIL = "mailto:soporte@handi.mx";

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

const clampSentenceCount = (text: string): string => {
  const parts = splitSentences(text);
  if (parts.length <= MAX_SENTENCES) return text.trim();
  return parts.slice(0, MAX_SENTENCES).join(" ").trim();
};

export function sanitizeAssistantText(input: string): string {
  let text = (input || "").trim();
  if (!text) return "";

  text = text
    .replace(UUID_RE, "")
    .replace(TECH_ROUTE_RE, "")
    .replace(APP_ROUTE_RE, " ")
    .replace(/\s{2,}/g, " ");

  text = text.replace(URL_RE, (url) => {
    if (url.startsWith(SUPPORT_WA)) return "WhatsApp de soporte";
    if (url.startsWith(SUPPORT_MAIL)) return "correo de soporte";
    return "";
  });

  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/[ \t]+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return clampSentenceCount(text);
}

function isAllowedExternalUrl(href: string): boolean {
  return href.startsWith(SUPPORT_WA) || href.startsWith(SUPPORT_MAIL);
}

export function sanitizeActions(actions: AssistantAction[]): AssistantAction[] {
  const out: AssistantAction[] = [];
  for (const action of actions || []) {
    const label = String(action.label || "").trim();
    const href = String(action.href || "").trim();
    if (!label || !href) continue;
    if (action.type === "app_link") {
      if (!ASSISTANT_SAFE_APP_LINKS.has(href)) continue;
      out.push({ ...action, label, href });
      continue;
    }
    if (isAllowedExternalUrl(href)) {
      out.push({ ...action, label, href });
    }
  }
  return out.slice(0, 4);
}

export function ensureNonEmptyResponse(text: string): {
  text: string;
  actions: AssistantAction[];
} {
  const sanitized = sanitizeAssistantText(text);
  if (sanitized.length > 0) return { text: sanitized, actions: [] };
  const fallback = supportFallbackResponse();
  return { text: fallback.response, actions: fallback.actions };
}

export function sseJson(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function sseTextChunk(delta: string): string {
  return sseJson({ type: "text", delta });
}

export function sseActions(actions: AssistantAction[]): string {
  return sseJson({ type: "actions", actions: sanitizeActions(actions) });
}

export function sseDone(): string {
  return sseJson({ type: "done" });
}
