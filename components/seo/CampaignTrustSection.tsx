import { Card } from "@/components/ui/card";
import TrustSectionViewTracker from "@/components/analytics/TrustSectionViewTracker.client";

type Props = {
  pageType: string;
  sectionId: string;
  title?: string;
  points: string[];
  serviceSlug?: string;
  citySlug?: string;
};

export default function CampaignTrustSection({
  pageType,
  sectionId,
  title = "Senales de confianza",
  points,
  serviceSlug,
  citySlug,
}: Props) {
  return (
    <Card className="rounded-2xl border bg-white p-5 shadow-sm">
      <TrustSectionViewTracker
        pageType={pageType}
        sectionId={sectionId}
        serviceSlug={serviceSlug}
        citySlug={citySlug}
      />
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {points.map((point) => (
          <li key={point}>• {point}</li>
        ))}
      </ul>
    </Card>
  );
}
