export const ASSISTANT_OPEN_EVENT = "handi:assistant-open";

export type AssistantOpenPayload = {
  message?: string;
};

export function openAssistant(payload?: AssistantOpenPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AssistantOpenPayload>(ASSISTANT_OPEN_EVENT, {
      detail: payload || {},
    }),
  );
}
