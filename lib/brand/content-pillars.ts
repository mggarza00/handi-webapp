import type { AudienceType } from "@/lib/ai/schemas";

export type ContentPillar = {
  title: string;
  intent: string;
  themes: string[];
};

export const CONTENT_PILLARS: Record<AudienceType, ContentPillar[]> = {
  client: [
    {
      title: "Trust And Safety",
      intent: "Reduce the fear of hiring the wrong person.",
      themes: ["Confidence in the process", "Professionalism", "Reliability"],
    },
    {
      title: "Practical Relief",
      intent: "Show how Handi removes friction from service needs.",
      themes: ["Fast clarity", "Less stress", "Simple next steps"],
    },
    {
      title: "Service Education",
      intent: "Help users understand what happens next and what to expect.",
      themes: ["How it works", "What to prepare", "Why trust matters"],
    },
  ],
  professional: [
    {
      title: "Professional Growth",
      intent: "Frame Handi as a serious growth tool for real pros.",
      themes: ["Visibility", "Better opportunities", "Professional image"],
    },
    {
      title: "Workflow Confidence",
      intent: "Show how Handi supports better order and follow-through.",
      themes: ["Less friction", "Clearer process", "Client trust"],
    },
    {
      title: "Craft Respect",
      intent: "Speak to the value of their skill and reputation.",
      themes: ["Experience matters", "Serious work", "Trust is earned"],
    },
  ],
  business: [
    {
      title: "Operational Reliability",
      intent: "Show that Handi helps reduce vendor chaos.",
      themes: [
        "Reliable providers",
        "Repeatable process",
        "Less coordination pain",
      ],
    },
    {
      title: "Service Governance",
      intent: "Position Handi as a clearer service coordination layer.",
      themes: ["Clarity", "Follow-through", "Accountability"],
    },
    {
      title: "Practical Efficiency",
      intent: "Tie Handi to time-saving and execution quality.",
      themes: ["Faster vendor access", "More order", "Useful oversight"],
    },
  ],
};
