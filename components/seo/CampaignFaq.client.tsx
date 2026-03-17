"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { trackFaqInteracted } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

type FaqItem = {
  question: string;
  answer: string;
};

type Props = {
  pageType: string;
  items: FaqItem[];
  serviceSlug?: string;
  citySlug?: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CampaignFaq({
  pageType,
  items,
  serviceSlug,
  citySlug,
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((faq, index) => {
        const isOpen = openIndex === index;
        const contentId = `faq-${pageType}-${index}`;
        return (
          <div
            key={`${faq.question}-${index}`}
            className="rounded-xl border bg-white"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={isOpen}
              aria-controls={contentId}
              onClick={() => {
                const nextOpen = isOpen ? null : index;
                setOpenIndex(nextOpen);
                if (nextOpen !== null) {
                  trackFaqInteracted({
                    page_type: pageType,
                    faq_id: slugify(faq.question) || `faq-${index + 1}`,
                    faq_question: faq.question,
                    service_slug: serviceSlug,
                    city_slug: citySlug,
                    source_page:
                      typeof window !== "undefined"
                        ? window.location.pathname
                        : undefined,
                  });
                }
              }}
            >
              <span className="text-sm font-semibold text-slate-900">
                {faq.question}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-500 transition-transform",
                  isOpen ? "rotate-180" : "",
                )}
                aria-hidden="true"
              />
            </button>
            <div
              id={contentId}
              className={cn(
                "grid px-4 text-sm text-slate-600 transition-all",
                isOpen ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">{faq.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
