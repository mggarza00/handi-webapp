import { NextRequest } from "next/server";

import {
  matchCanonicalIntent,
  supportFallbackResponse,
} from "@/lib/assistant/intents";
import { SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import {
  ensureNonEmptyResponse,
  sanitizeActions,
  sanitizeAssistantText,
  sseActions,
  sseDone,
  sseTextChunk,
} from "@/lib/assistant/response";
import { getHelpEntry } from "@/lib/assistant/tools";
import type { AssistantAction, ChatMessage } from "@/types/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages?: ChatMessage[];
  page?: { pathname?: string } | null;
  user?: { role?: "client" | "pro" | null } | null;
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function splitForStream(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [normalized];
}

function extractLastUserMessage(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return (last?.content || "").slice(0, 2400).trim();
}

function looksSensitive(query: string): boolean {
  const q = query.toLowerCase();
  const markers = [
    "fraude",
    "demanda",
    "disputa",
    "cobro",
    "duplicado",
    "reembolso",
    "no funciona",
    "falla",
    "error",
    "problema tecnico",
    "soporte",
    "denuncia",
  ];
  return markers.some((marker) => q.includes(marker));
}

function buildActionsFromHelpLinks(links: string[]): AssistantAction[] {
  const out: AssistantAction[] = [];
  for (const link of links) {
    if (typeof link !== "string") continue;
    const clean = link.trim();
    if (!clean.startsWith("/")) continue;
    if (clean.startsWith("/help")) {
      out.push({ type: "app_link", label: "Ver ayuda", href: "/help" });
    }
    if (clean.startsWith("/requests/new")) {
      out.push({
        type: "app_link",
        label: "Ir a nueva solicitud",
        href: "/requests/new",
      });
    }
    if (clean.startsWith("/mensajes")) {
      out.push({
        type: "app_link",
        label: "Abrir mensajes",
        href: "/mensajes",
      });
    }
    if (clean.startsWith("/applied")) {
      out.push({
        type: "app_link",
        label: "Ver trabajos realizados",
        href: "/applied",
      });
    }
  }
  if (!out.find((a) => a.href === "/help")) {
    out.push({ type: "app_link", label: "Ver ayuda", href: "/help" });
  }
  if (!out.find((a) => a.type === "whatsapp")) {
    out.push({
      type: "whatsapp",
      label: "Abrir WhatsApp",
      href: "https://wa.me/528130878691",
    });
  }
  return out;
}

async function callOpenAISecondary(args: {
  userRole: "client" | "pro" | null;
  pathname: string;
  query: string;
  hint?: string;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `CONTEXTO_APP: ruta=${args.pathname} rol=${args.userRole || "unknown"}`,
    },
    {
      role: "system",
      content:
        "Responde breve y accionable. No pongas rutas ni URLs en el texto. Si hay riesgo o duda, sugiere WhatsApp de soporte.",
    },
    ...(args.hint
      ? [{ role: "system", content: `CONTEXTO_FAQ: ${args.hint}` }]
      : []),
    { role: "user", content: args.query },
  ];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 220,
      messages,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  } | null;
  const text = json?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text : null;
}

async function writeStructuredResponse(args: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  text: string;
  actions?: AssistantAction[];
}) {
  const { controller, encoder } = args;
  const safeText = sanitizeAssistantText(args.text);
  const chunks = splitForStream(safeText);
  for (const chunk of chunks) {
    controller.enqueue(
      encoder.encode(sseTextChunk(`${chunk}${chunk.endsWith(".") ? "" : " "}`)),
    );
  }
  const safeActions = sanitizeActions(args.actions || []);
  if (safeActions.length > 0) {
    controller.enqueue(encoder.encode(sseActions(safeActions)));
  }
  controller.enqueue(encoder.encode(sseDone()));
}

export async function POST(req: NextRequest) {
  let body: IncomingBody | null = null;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    body = null;
  }

  const userRole = body?.user?.role || null;
  const pathname = body?.page?.pathname || "/";
  const messages = body?.messages || [];
  const query = extractLastUserMessage(messages);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        if (!query) {
          const fallback = supportFallbackResponse();
          await writeStructuredResponse({
            controller,
            encoder,
            text: fallback.response,
            actions: fallback.actions,
          });
          return;
        }

        const intent = matchCanonicalIntent(query, userRole);
        if (intent) {
          await writeStructuredResponse({
            controller,
            encoder,
            text: intent.response,
            actions: intent.actions,
          });
          return;
        }

        if (looksSensitive(query)) {
          const fallback = supportFallbackResponse();
          await writeStructuredResponse({
            controller,
            encoder,
            text: fallback.response,
            actions: fallback.actions,
          });
          return;
        }

        const faq = await getHelpEntry(query);
        if (faq.ok && faq.score >= 0.82) {
          const answer = ensureNonEmptyResponse(faq.answer);
          await writeStructuredResponse({
            controller,
            encoder,
            text: answer.text,
            actions: buildActionsFromHelpLinks(faq.links || []),
          });
          return;
        }

        const llm = await callOpenAISecondary({
          userRole,
          pathname,
          query,
          hint: faq?.answer,
        });
        if (llm) {
          const safeLlm = sanitizeAssistantText(llm);
          const uncertain = /no se|no estoy seguro|depende sin contexto/i.test(
            safeLlm,
          );
          if (!safeLlm || uncertain) {
            const fallback = supportFallbackResponse();
            await writeStructuredResponse({
              controller,
              encoder,
              text: fallback.response,
              actions: fallback.actions,
            });
            return;
          }
          await writeStructuredResponse({
            controller,
            encoder,
            text: safeLlm,
            actions: buildActionsFromHelpLinks(faq.links || []),
          });
          return;
        }

        const fallback = supportFallbackResponse();
        await writeStructuredResponse({
          controller,
          encoder,
          text: fallback.response,
          actions: fallback.actions,
        });
      } catch (error) {
        console.error("[assistant] route error", error);
        const fallback = supportFallbackResponse();
        await writeStructuredResponse({
          controller,
          encoder,
          text: fallback.response,
          actions: fallback.actions,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
