import { FAQS } from "./faqs";

import type { RetrievedAnswer } from "@/types/assistant";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9\s#:/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const n = normalize(text);
  const toks = n.split(" ").filter(Boolean);
  const stop = new Set([
    "de",
    "la",
    "el",
    "los",
    "las",
    "y",
    "o",
    "un",
    "una",
    "en",
    "por",
    "con",
    "a",
    "al",
    "del",
  ]);
  return toks.filter((t) => !stop.has(t));
}

function scoreQueryToText(
  query: string,
  text: string,
  extra: string[] = [],
): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const t = tokenize(text).concat(extra.map(normalize));
  const tset = new Map<string, number>();
  for (const tok of t) tset.set(tok, (tset.get(tok) || 0) + 1);

  let s = 0;
  for (const [i, tok] of q.entries()) {
    const tf = tset.get(tok) || 0;
    if (tf > 0) s += 1 + Math.log(1 + tf);
    if (i < q.length - 1) {
      const bigram = `${tok} ${q[i + 1]}`;
      if (normalize(text).includes(bigram)) s += 0.5;
    }
  }
  const lenPenalty = Math.min(1, t.length / 50);
  return s * (0.7 + 0.3 * lenPenalty);
}

export function retrieveAnswer(query: string): RetrievedAnswer {
  const scored = FAQS.map((faq) => {
    const base = `${faq.question} ${faq.answer}`;
    const s = scoreQueryToText(query, base, faq.keywords || []);
    return { faq, score: s };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return {
      answer:
        "No tengo una respuesta directa con alta certeza. Te recomiendo revisar ayuda o contactar soporte de Handi por WhatsApp.",
      sources: [],
    };
  }

  const top = scored[0];
  const sources = scored.map((x) => ({
    id: x.faq.id,
    url: x.faq.url,
    score: Number(x.score.toFixed(3)),
  }));

  return {
    answer: top.faq.answer,
    sources,
  };
}
