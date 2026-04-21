import { PROHIBITED_CLAIMS } from "@/lib/brand/claims";
import { CHANNEL_RULES } from "@/lib/brand/channel-rules";
import { AUDIENCE_SEGMENTS } from "@/lib/brand/audiences";
import {
  CORE_TONE_RULES,
  TONE_BY_AUDIENCE,
  TONE_BY_CHANNEL,
} from "@/lib/brand/tone";
import type {
  CampaignDraftRow,
  CampaignMessageRow,
  CampaignQaReport,
  MessageQaReport,
  ReviewerPriority,
  StructuredMessageRationale,
} from "@/lib/campaigns/workflow";
import {
  buildDefaultCampaignQaReport,
  buildDefaultMessageQaReport,
  clampScore,
  parseMessageRationale,
} from "@/lib/campaigns/workflow";

type QaIssue = {
  key: string;
  severity: "low" | "medium" | "high";
  warning: string;
  suggestion?: string;
  impact?: Partial<{
    brandFit: number;
    clarity: number;
    cta: number;
    channelFit: number;
    risk: number;
  }>;
};

type MessageQaAccumulator = {
  brandFit: number;
  clarity: number;
  cta: number;
  channelFit: number;
  risk: number;
  warnings: string[];
  suggestions: string[];
  detectedIssues: string[];
};

const CHANNEL_LENGTH_LIMITS: Record<
  CampaignMessageRow["channel"],
  {
    headlineMax: number;
    bodyMin?: number;
    bodyMax: number;
  }
> = {
  meta: { headlineMax: 70, bodyMax: 220 },
  email: { headlineMax: 90, bodyMin: 90, bodyMax: 900 },
  whatsapp: { headlineMax: 80, bodyMin: 40, bodyMax: 360 },
  push: { headlineMax: 45, bodyMax: 120 },
  landing: { headlineMax: 90, bodyMin: 140, bodyMax: 2000 },
};

const CTA_WEAK_PATTERNS = [
  "click aqui",
  "click here",
  "ver mas",
  "learn more",
  "mas info",
  "continuar",
  "seguir",
  "tap here",
];

const ACTION_WORDS = [
  "solicita",
  "solicitar",
  "agenda",
  "agendar",
  "empieza",
  "empezar",
  "descubre",
  "pide",
  "cotiza",
  "encuentra",
  "explora",
  "completa",
  "activa",
  "retoma",
  "vuelve",
  "responde",
  "abre",
];

const AGGRESSIVE_MARKERS = [
  "ahora o nunca",
  "ultimo chance",
  "corre",
  "ya mismo",
  "de una vez",
  "wow",
  "mega",
  "brutal",
  "explosivo",
  "asap",
  "dont miss",
  "don't miss",
];

const FORCED_SPANGLISH_MARKERS = [
  "upgrade",
  "deal",
  "best",
  "workflow",
  "growth",
  "boost",
  "performance",
  "awareness",
  "conversion",
  "leads",
  "easy",
  "fast",
];

const VAGUE_MARKERS = [
  "solucion ideal",
  "gran experiencia",
  "todo lo que necesitas",
  "mejor opcion",
  "servicio de calidad",
  "soluciones integrales",
  "mejor alternativa",
];

const ABSOLUTE_CLAIM_MARKERS = [
  "100%",
  "siempre",
  "nunca",
  "garantizado",
  "garantizada",
  "sin falla",
  "el mejor",
  "la mejor",
  "numero uno",
  "#1",
  "mas barato",
  "resultados inmediatos",
];

const GOAL_KEYWORDS: Partial<Record<CampaignDraftRow["goal"], string[]>> = {
  acquisition: ["solicita", "descubre", "encuentra", "pide", "agenda"],
  activation: ["activa", "completa", "empieza", "configura", "termina"],
  conversion: ["solicita", "agenda", "empieza", "cotiza", "pide"],
  reactivation: ["vuelve", "retoma", "regresa", "otra vez", "de nuevo"],
  retention: ["sigue", "mantente", "continua", "aprovecha"],
};

const AUDIENCE_CUES: Record<CampaignDraftRow["audience"], string[]> = {
  client: [
    "confianza",
    "tranquilidad",
    "seguro",
    "claro",
    "facil",
    "pros",
    "hogar",
    "oficina",
  ],
  professional: [
    "clientes",
    "oportunidades",
    "leads",
    "visibilidad",
    "perfil",
    "trabajo",
    "flujo",
    "profesional",
  ],
  business: [
    "equipo",
    "operacion",
    "proveedores",
    "coordinacion",
    "proceso",
    "empresa",
    "negocio",
  ],
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text: string, items: string[]) {
  const normalized = normalize(text);
  return items.some((item) => normalized.includes(normalize(item)));
}

function countMatches(text: string, items: string[]) {
  const normalized = normalize(text);
  return items.filter((item) => normalized.includes(normalize(item))).length;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function addIssue(acc: MessageQaAccumulator, issue: QaIssue) {
  acc.detectedIssues.push(issue.key);
  acc.warnings.push(issue.warning);

  if (issue.suggestion) {
    acc.suggestions.push(issue.suggestion);
  }

  if (issue.impact?.brandFit) acc.brandFit -= issue.impact.brandFit;
  if (issue.impact?.clarity) acc.clarity -= issue.impact.clarity;
  if (issue.impact?.cta) acc.cta -= issue.impact.cta;
  if (issue.impact?.channelFit) acc.channelFit -= issue.impact.channelFit;
  if (issue.impact?.risk) acc.risk += issue.impact.risk;
}

function buildPriority(
  overallScore: number,
  riskScore: number,
): ReviewerPriority {
  if (riskScore >= 65 || overallScore < 55) return "urgent";
  if (riskScore >= 45 || overallScore < 70) return "high";
  if (riskScore >= 25 || overallScore < 82) return "medium";
  return "low";
}

function buildQaStatus(overallScore: number, riskScore: number) {
  if (riskScore >= 60 || overallScore < 60) return "high_risk" as const;
  if (overallScore < 80 || riskScore >= 25) return "needs_attention" as const;
  return "ready_for_review" as const;
}

function analyzeRationale(
  rationale: StructuredMessageRationale,
  acc: MessageQaAccumulator,
) {
  const missingFields = [
    rationale.angle ? "" : "angle",
    rationale.audienceIntent ? "" : "audience intent",
    rationale.whyChannel ? "" : "why this channel",
    rationale.whyCta ? "" : "why this CTA",
  ].filter(Boolean);

  if (missingFields.length) {
    addIssue(acc, {
      key: "rationale_incomplete",
      severity: "medium",
      warning: `Rationale is missing ${missingFields.join(", ")}.`,
      suggestion:
        "Complete the rationale so the reviewer can understand the choice quickly.",
      impact: { clarity: 10, brandFit: 8, channelFit: 6 },
    });
  }

  if ((rationale.summary || "").trim().length < 30) {
    addIssue(acc, {
      key: "rationale_thin",
      severity: "low",
      warning: "Rationale summary is too thin to explain the proposal clearly.",
      suggestion:
        "Add one sentence that explains the main choice and its intended effect.",
      impact: { clarity: 6, brandFit: 4 },
    });
  }
}

export function analyzeCampaignMessage(args: {
  draft: Pick<
    CampaignDraftRow,
    | "audience"
    | "goal"
    | "service_category"
    | "offer"
    | "cta"
    | "brand_context"
    | "recommended_angle"
  >;
  message: Pick<
    CampaignMessageRow,
    "channel" | "format" | "content" | "rationale" | "variant_name"
  >;
}): MessageQaReport {
  const fallback = buildDefaultMessageQaReport();
  const fullCopy = [
    args.message.content.headline,
    args.message.content.body,
    args.message.content.cta,
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedCopy = normalize(fullCopy);
  const rationale = parseMessageRationale(args.message.rationale);
  const channelRules = CHANNEL_RULES[args.message.channel];
  const channelLimits = CHANNEL_LENGTH_LIMITS[args.message.channel];
  const audienceProfile = AUDIENCE_SEGMENTS[args.draft.audience];
  const acc: MessageQaAccumulator = {
    brandFit: 100,
    clarity: 100,
    cta: 100,
    channelFit: 100,
    risk: 0,
    warnings: [],
    suggestions: [],
    detectedIssues: [],
  };

  if (args.message.content.headline.length > channelLimits.headlineMax) {
    addIssue(acc, {
      key: "headline_too_long",
      severity: "medium",
      warning: `${args.message.channel} headline is longer than the recommended limit.`,
      suggestion: "Tighten the opening line so the main benefit lands faster.",
      impact: { clarity: 12, channelFit: 14 },
    });
  }

  if (
    typeof channelLimits.bodyMin === "number" &&
    args.message.content.body.length < channelLimits.bodyMin
  ) {
    addIssue(acc, {
      key: "body_too_short",
      severity: "low",
      warning: `${args.message.channel} copy may be too thin to explain the value clearly.`,
      suggestion:
        "Add one more concrete line that explains the service value or trust cue.",
      impact: { clarity: 8, channelFit: 8 },
    });
  }

  if (args.message.content.body.length > channelLimits.bodyMax) {
    addIssue(acc, {
      key: "body_too_long",
      severity: "medium",
      warning: `${args.message.channel} copy is longer than the recommended channel range.`,
      suggestion:
        "Trim the copy to one stronger idea and leave only the most useful trust cue.",
      impact: { clarity: 14, channelFit: 18 },
    });
  }

  if (!args.message.content.cta.trim()) {
    addIssue(acc, {
      key: "cta_missing",
      severity: "high",
      warning: "CTA is missing.",
      suggestion: "Add one direct CTA that matches the campaign goal.",
      impact: { cta: 35, clarity: 12, channelFit: 10 },
    });
  } else if (containsAny(args.message.content.cta, CTA_WEAK_PATTERNS)) {
    addIssue(acc, {
      key: "cta_weak",
      severity: "medium",
      warning: "CTA is too generic for a decision-ready message.",
      suggestion: "Use a calmer but more specific CTA tied to the next step.",
      impact: { cta: 22, clarity: 8 },
    });
  }

  if (!containsAny(fullCopy, ACTION_WORDS)) {
    addIssue(acc, {
      key: "copy_not_actionable",
      severity: "medium",
      warning:
        "Copy feels low-action and does not clearly move the reader to the next step.",
      suggestion: "Add one explicit action verb in the body or CTA.",
      impact: { cta: 20, clarity: 12 },
    });
  }

  if (
    containsAny(fullCopy, AGGRESSIVE_MARKERS) ||
    /!{2,}|\?{2,}|[A-Z]{4,}/.test(fullCopy)
  ) {
    addIssue(acc, {
      key: "tone_aggressive",
      severity: "high",
      warning: "Tone feels too aggressive or too loud for Handi.",
      suggestion:
        "Replace hype or urgency markers with calmer, trust-first wording.",
      impact: { brandFit: 20, clarity: 10, risk: 18 },
    });
  }

  const riskyClaims = [
    ...PROHIBITED_CLAIMS.filter((claim) => containsAny(fullCopy, [claim])),
    ...ABSOLUTE_CLAIM_MARKERS.filter((claim) => containsAny(fullCopy, [claim])),
  ];

  if (riskyClaims.length) {
    addIssue(acc, {
      key: "risky_claims",
      severity: "high",
      warning: `Detected risky or absolute claims: ${uniqueStrings(riskyClaims).join(", ")}.`,
      suggestion:
        "Replace absolute claims with believable proof, process, or reassurance.",
      impact: { brandFit: 28, clarity: 8, risk: 34 },
    });
  }

  if (countMatches(fullCopy, FORCED_SPANGLISH_MARKERS) >= 3) {
    addIssue(acc, {
      key: "spanglish_forced",
      severity: "medium",
      warning: "Spanglish feels forced or too marketing-heavy.",
      suggestion:
        "Keep English terms only when they feel natural and optional.",
      impact: { brandFit: 16, clarity: 12, risk: 8 },
    });
  }

  if (containsAny(fullCopy, VAGUE_MARKERS)) {
    addIssue(acc, {
      key: "vague_copy",
      severity: "medium",
      warning:
        "Copy relies on vague marketing language instead of a concrete value.",
      suggestion: `Name the service context more directly and explain why ${args.draft.service_category} feels easier with Handi.`,
      impact: { clarity: 18, brandFit: 8 },
    });
  }

  if (!normalizedCopy.includes(normalize(args.draft.service_category))) {
    addIssue(acc, {
      key: "service_context_missing",
      severity: "low",
      warning: "The service category is not explicit in the copy.",
      suggestion:
        "Name the service context more clearly so the message feels less generic.",
      impact: { clarity: 8, channelFit: 6 },
    });
  }

  if (!containsAny(fullCopy, AUDIENCE_CUES[args.draft.audience])) {
    addIssue(acc, {
      key: "audience_misaligned",
      severity: "medium",
      warning: `Copy does not strongly reflect ${audienceProfile.label.toLowerCase()} needs or trust triggers.`,
      suggestion: `Bring in one cue tied to ${args.draft.audience} intent, such as ${audienceProfile.trustTriggers[0].toLowerCase()}.`,
      impact: { brandFit: 14, clarity: 10 },
    });
  }

  const goalTerms = GOAL_KEYWORDS[args.draft.goal] || [];

  if (goalTerms.length && !containsAny(fullCopy, goalTerms)) {
    addIssue(acc, {
      key: "goal_misaligned",
      severity: "low",
      warning: `Copy is not strongly signaling the campaign goal of ${args.draft.goal}.`,
      suggestion: `Adjust the CTA or body so the message feels more aligned to ${args.draft.goal}.`,
      impact: { cta: 8, channelFit: 8 },
    });
  }

  if (
    args.message.channel === "whatsapp" &&
    !/[\n.!?]/.test(args.message.content.body)
  ) {
    addIssue(acc, {
      key: "whatsapp_wall_of_text",
      severity: "medium",
      warning: "WhatsApp copy reads like a wall of text.",
      suggestion:
        "Break the message into short blocks with a clearer opening context.",
      impact: { clarity: 16, channelFit: 18 },
    });
  }

  if (
    args.message.channel === "email" &&
    !/[\n:]/.test(args.message.content.body)
  ) {
    addIssue(acc, {
      key: "email_not_structured",
      severity: "low",
      warning: "Email copy could use more visible structure.",
      suggestion:
        "Add clearer hierarchy so the email explains value before the ask.",
      impact: { clarity: 10, channelFit: 10 },
    });
  }

  if (
    args.message.channel === "push" &&
    args.message.content.body.split(/[.!?]/).filter(Boolean).length > 2
  ) {
    addIssue(acc, {
      key: "push_multiple_ideas",
      severity: "medium",
      warning: "Push copy is trying to carry more than one idea.",
      suggestion: "Keep the push focused on one timely action only.",
      impact: { clarity: 12, channelFit: 18 },
    });
  }

  if (
    containsAny(fullCopy, CORE_TONE_RULES.dontList) ||
    containsAny(fullCopy, TONE_BY_AUDIENCE[args.draft.audience].dontList) ||
    containsAny(fullCopy, TONE_BY_CHANNEL[args.message.channel].dontList)
  ) {
    addIssue(acc, {
      key: "tone_rule_conflict",
      severity: "medium",
      warning: "Copy appears to conflict with Handi tone directives.",
      suggestion: "Rewrite with calmer grammar, lower friction, and less hype.",
      impact: { brandFit: 14, clarity: 8, risk: 10 },
    });
  }

  if (
    !channelRules.ctaRules.some((rule) =>
      containsAny(
        args.message.content.cta,
        ACTION_WORDS.concat(rule.split(" ")),
      ),
    )
  ) {
    addIssue(acc, {
      key: "cta_channel_mismatch",
      severity: "low",
      warning: `CTA is not strongly aligned to ${args.message.channel} channel guidance.`,
      suggestion: `Rewrite the CTA so it feels more natural for ${args.message.channel}.`,
      impact: { cta: 10, channelFit: 8 },
    });
  }

  analyzeRationale(rationale, acc);

  const brandFit = clampScore(acc.brandFit);
  const clarity = clampScore(acc.clarity);
  const cta = clampScore(acc.cta);
  const channelFit = clampScore(acc.channelFit);
  const risk = clampScore(acc.risk);
  const overallScore = clampScore(
    (brandFit + clarity + cta + channelFit + (100 - risk)) / 5,
  );
  const reviewerPriority = buildPriority(overallScore, risk);
  const qaStatus = buildQaStatus(overallScore, risk);

  return {
    ...fallback,
    qa_status: qaStatus,
    reviewer_priority: reviewerPriority,
    overall_score: overallScore,
    brand_fit_score: brandFit,
    clarity_score: clarity,
    cta_score: cta,
    channel_fit_score: channelFit,
    risk_score: risk,
    warnings: uniqueStrings(acc.warnings),
    suggestions: uniqueStrings(acc.suggestions).slice(0, 6),
    detected_issues: uniqueStrings(acc.detectedIssues),
    analyzed_at: new Date().toISOString(),
    ready_for_review: qaStatus === "ready_for_review",
  };
}

export function analyzeCampaignQa(args: {
  draft: Pick<
    CampaignDraftRow,
    | "title"
    | "audience"
    | "goal"
    | "channels"
    | "service_category"
    | "offer"
    | "cta"
    | "brand_context"
    | "recommended_angle"
  >;
  messages: Array<
    Pick<
      CampaignMessageRow,
      "id" | "channel" | "format" | "content" | "rationale" | "variant_name"
    >
  >;
}): {
  campaignQa: CampaignQaReport;
  messageQaById: Record<string, MessageQaReport>;
} {
  const fallback = buildDefaultCampaignQaReport();
  const messageQaById = Object.fromEntries(
    args.messages.map((message) => [
      message.id,
      analyzeCampaignMessage({
        draft: args.draft,
        message,
      }),
    ]),
  );
  const reports = Object.values(messageQaById);

  if (!reports.length) {
    return {
      campaignQa: fallback,
      messageQaById,
    };
  }

  const overallScore = clampScore(
    reports.reduce((sum, item) => sum + item.overall_score, 0) / reports.length,
  );
  const highestRisk = reports.reduce(
    (max, item) => Math.max(max, item.risk_score),
    0,
  );
  const highestPriority = reports.reduce<ReviewerPriority>((current, item) => {
    const rank: Record<ReviewerPriority, number> = {
      low: 1,
      medium: 2,
      high: 3,
      urgent: 4,
    };

    return rank[item.reviewer_priority] > rank[current]
      ? item.reviewer_priority
      : current;
  }, "low");
  const qaStatus = buildQaStatus(overallScore, highestRisk);
  const warnings = uniqueStrings(
    reports.flatMap((item) => item.warnings),
  ).slice(0, 8);
  const suggestions = uniqueStrings(
    reports.flatMap((item) => item.suggestions),
  ).slice(0, 6);
  const highRiskCount = reports.filter(
    (item) => item.qa_status === "high_risk",
  ).length;
  const needsAttentionCount = reports.filter(
    (item) => item.qa_status === "needs_attention",
  ).length;

  return {
    campaignQa: {
      qa_status: qaStatus,
      reviewer_priority: highestPriority,
      overall_score: overallScore,
      summary:
        qaStatus === "ready_for_review"
          ? "QA did not detect significant brand, clarity, CTA, or risk issues."
          : highRiskCount > 0
            ? `${highRiskCount} variant${highRiskCount === 1 ? "" : "s"} show high editorial risk and should be reviewed first.`
            : `${needsAttentionCount} variant${needsAttentionCount === 1 ? "" : "s"} need editorial cleanup before review feels easy.`,
      warnings,
      suggestions,
      analyzed_at: new Date().toISOString(),
      ready_for_review: qaStatus === "ready_for_review",
    },
    messageQaById,
  };
}
