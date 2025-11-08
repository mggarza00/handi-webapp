import { NextRequest } from "next/server";
import type { ChatMessage } from "@/types/assistant";
import { SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import { getHelpEntry, openAppLink, whoAmI } from "@/lib/assistant/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages?: ChatMessage[];
  page?: { pathname?: string } | null;
  user?: { role?: "client" | "pro" | null } | null;
};

type OpenAIAssistantToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAIMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: OpenAIAssistantToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function sse(data: string) {
  return `data: ${data}\n\n`;
}

function encodeSSE(controller: ReadableStreamDefaultController<Uint8Array>, text: string) {
  const enc = new TextEncoder();
  controller.enqueue(enc.encode(sse(text)));
}

function toolSpecs() {
  return [
    {
      type: "function",
      function: {
        name: "getHelpEntry",
        description: "Busca en FAQs internas de Handi y devuelve un resumen con score y links.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Consulta del usuario" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "openAppLink",
        description: "Devuelve rutas internas seguras (por ejemplo /help, /requests/new, /pro/apply).",
        parameters: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Identificador o ruta corta" },
          },
          required: ["slug"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "whoAmI",
        description: "Retorna el rol del usuario autenticado si se conoce.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
  ];
}

async function callOpenAIStream(openaiMessages: OpenAIMessage[]) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      messages: openaiMessages,
      tools: toolSpecs(),
      tool_choice: "auto",
      temperature: 0.3,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${text}`);
  }
  return res.body;
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
  const msgs = body?.messages || [];

  // If there's no OpenAI key, fall back to local FAQs (RAG) so the bot still works.
  if (!process.env.OPENAI_API_KEY) {
    const enc = new TextEncoder();
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    const query = (lastUser?.content || "").slice(0, 2000);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const res = await getHelpEntry(query);
          const text = res.answer + (res.links?.[0] ? `\n\nVer: ${res.links[0]}` : "");
          controller.enqueue(enc.encode(sse(text)));
        } catch {
          controller.enqueue(enc.encode(sse("Configura OPENAI_API_KEY en .env.local")));
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

  const openaiMessages: OpenAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `APP_PATHNAME: ${pathname}` },
    { role: "system", content: `USER_ROLE: ${userRole || "unknown"}` },
    ...msgs.map((m) => ({ role: m.role, content: m.content } as OpenAIMessage)),
  ];

  // SSE pipe to client while orchestrating tool calls
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      const enc = new TextEncoder();
      const write = (data: string) => controller.enqueue(enc.encode(sse(data)));
      try {
        // First pass: ask OpenAI and collect either content or tool_calls
        let toolCalls: ToolCall[] = [];
        let contentYielded = false;
        const bodyStream = await callOpenAIStream(openaiMessages);
        const reader = bodyStream.getReader();
        let partialTool: Record<number, ToolCall> = {};
        let lineBuffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          lineBuffer += chunk;
          const rawLines = lineBuffer.split(/\n/);
          lineBuffer = rawLines.pop() || "";
          const lines = rawLines.filter((l) => l.trim().startsWith("data:"));
          for (const line of lines) {
            const data = line.replace(/^data:\s*/, "").trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta || {};
              if (typeof delta.content === "string") {
                contentYielded = true;
                write(delta.content);
              }
              const tc = delta.tool_calls as
                | Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>
                | undefined;
              if (tc && tc.length) {
                for (const item of tc) {
                  const idx = item.index;
                  const current = partialTool[idx] || ({ id: "", type: "function", function: { name: "", arguments: "" } } as ToolCall);
                  if (item.id) current.id = item.id;
                  if (item.function?.name) current.function.name = item.function.name;
                  if (item.function?.arguments) current.function.arguments += item.function.arguments;
                  partialTool[idx] = current;
                }
              }
            } catch {
              // ignore malformed line
            }
          }
        }
        toolCalls = Object.values(partialTool);

        if (toolCalls.length && !contentYielded) {
          // Execute tools
          const toolMessages: OpenAIMessage[] = [];
          for (const call of toolCalls) {
            const name = call.function.name;
            const args = call.function.arguments || "{}";
            let result: unknown = null;
            try {
              if (name === "getHelpEntry") {
                const parsed = JSON.parse(args || "{}");
                result = await getHelpEntry(String(parsed.query || ""));
              } else if (name === "openAppLink") {
                const parsed = JSON.parse(args || "{}");
                result = openAppLink(String(parsed.slug || "help"));
              } else if (name === "whoAmI") {
                result = whoAmI({ userRole });
              } else {
                result = { ok: false, error: "UNKNOWN_TOOL" };
              }
            } catch (err) {
              result = { ok: false, error: String((err as Error).message || err) };
            }
            toolMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          }

          // Second pass: let the model answer with tool results
          const assistantWithCalls: OpenAIMessage = {
            role: "assistant",
            content: null,
            tool_calls: toolCalls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.function.name, arguments: c.function.arguments },
            })),
          };

          const followup: OpenAIMessage[] = [
            ...openaiMessages,
            assistantWithCalls,
            ...toolMessages,
          ];

          const bodyStream2 = await callOpenAIStream(followup);
          const reader2 = bodyStream2.getReader();
          let lineBuffer2 = "";
          while (true) {
            const { done, value } = await reader2.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            lineBuffer2 += chunk;
            const rawLines2 = lineBuffer2.split(/\n/);
            lineBuffer2 = rawLines2.pop() || "";
            const lines = rawLines2.filter((l) => l.trim().startsWith("data:"));
            for (const line of lines) {
              const data = line.replace(/^data:\s*/, "").trim();
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta || {};
                if (typeof delta.content === "string") {
                  write(delta.content);
                }
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (err) {
        console.error("[assistant] OpenAI stream error:", err);
        // Fallback: answer via local FAQs if OpenAI fails
        try {
          const lastUser = [...msgs].reverse().find((m) => m.role === "user");
          const query = (lastUser?.content || "").slice(0, 2000);
          const res = await getHelpEntry(query);
          const text = res.answer + (res.links?.[0] ? `\n\nVer: ${res.links[0]}` : "");
          write(text);
        } catch {
          write("Lo siento, hubo un problema generando la respuesta.");
        }
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
