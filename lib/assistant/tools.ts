import { retrieveAnswer } from "@/lib/assistant/rag";

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
    score: typeof top?.score === "number" ? top.score : (sources.length ? 0.5 : 0),
    answer,
    links: sources.map((s) => s.url || "/help"),
  };
}

export function openAppLink(slug: string): { ok: boolean; url: string } {
  const clean = String(slug || "").trim().toLowerCase();
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

export function whoAmI(ctx?: { userRole?: "client" | "pro" | null }): { role?: "client" | "pro" } {
  const role = ctx?.userRole === "client" || ctx?.userRole === "pro" ? ctx.userRole : undefined;
  return role ? { role } : {};
}

