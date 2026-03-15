export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AssistantActionType =
  | "app_link"
  | "external_link"
  | "whatsapp"
  | "mailto";

export type AssistantAction = {
  type: AssistantActionType;
  label: string;
  href: string;
};

export type AssistantIntentId =
  | "create_request"
  | "apply_to_job"
  | "contact_support"
  | "open_messages"
  | "chat_locked"
  | "client_not_responding"
  | "view_completed_jobs"
  | "upload_evidence"
  | "payments_receipt"
  | "reschedule_confirm_time"
  | "service_problem"
  | "missing_requests"
  | "cannot_apply"
  | "technical_issue";

export type FAQItem = {
  id: string;
  category: "General" | "Clientes" | "Profesionales" | "Pagos" | "Cuenta";
  question: string;
  answer: string;
  url?: string; // e.g. /help#id
  keywords?: string[];
};

export type RetrievedAnswer = {
  answer: string;
  sources: Array<{ id: string; url?: string; score: number }>;
  meta?: Record<string, unknown>;
};
