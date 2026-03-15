import type { AssistantAction } from "@/types/assistant";

export type AssistantStreamEvent =
  | { type: "text"; delta: string }
  | { type: "actions"; actions: AssistantAction[] }
  | { type: "done" }
  | { type: "legacy_text"; delta: string };

export function parseAssistantPayload(payload: string): AssistantStreamEvent {
  const raw = payload || "";
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      delta?: unknown;
      actions?: unknown;
    } | null;
    if (!parsed || typeof parsed !== "object") {
      return { type: "legacy_text", delta: raw };
    }
    if (parsed.type === "text" && typeof parsed.delta === "string") {
      return { type: "text", delta: parsed.delta };
    }
    if (parsed.type === "actions" && Array.isArray(parsed.actions)) {
      return { type: "actions", actions: parsed.actions as AssistantAction[] };
    }
    if (parsed.type === "done") {
      return { type: "done" };
    }
    return { type: "legacy_text", delta: raw };
  } catch {
    return { type: "legacy_text", delta: raw };
  }
}
