import { retrieveAnswer } from "@/lib/assistant/rag";
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP_LINK,
  SUPPORT_WHATSAPP_NUMBER,
} from "@/lib/support/contact";

export type GetHelpEntryResult = {
  ok: boolean;
  score: number;
  answer: string;
  links: string[];
};

export async function getHelpEntry(query: string): Promise<GetHelpEntryResult> {
  const { answer, sources } = retrieveAnswer(query || "");
  const top = sources[0];
  return {
    ok: true,
    score:
      typeof top?.score === "number" ? top.score : sources.length ? 0.5 : 0,
    answer,
    links: sources.map((s) => s.url || "/help"),
  };
}

export function openAppLink(slug: string): { ok: boolean; url: string } {
  const clean = String(slug || "")
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    help: "/help",
    "requests-new": "/requests/new",
    "requests/new": "/requests/new",
    "pro-apply": "/pro/apply",
    "profile-setup": "/profile/setup",
    applied: "/applied",
  };
  const url = map[clean] || "/help";
  return { ok: true, url };
}

export function whoAmI(ctx?: { userRole?: "client" | "pro" | null }): {
  role?: "client" | "pro";
} {
  const role =
    ctx?.userRole === "client" || ctx?.userRole === "pro"
      ? ctx.userRole
      : undefined;
  return role ? { role } : {};
}

export function getSupportContact(): {
  ok: true;
  email: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  whatsappLink: string;
  helpUrl: "/help";
  messagesUrl: "/mensajes";
} {
  return {
    ok: true,
    email: SUPPORT_EMAIL,
    whatsappNumber: SUPPORT_WHATSAPP_NUMBER,
    whatsappDisplay: SUPPORT_WHATSAPP_DISPLAY,
    whatsappLink: SUPPORT_WHATSAPP_LINK,
    helpUrl: "/help",
    messagesUrl: "/mensajes",
  };
}
