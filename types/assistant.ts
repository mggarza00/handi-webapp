export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

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

