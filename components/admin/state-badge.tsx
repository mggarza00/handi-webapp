import { Badge } from "@/components/ui/badge";

const MAP: Record<string, "default" | "secondary" | "destructive" | "outline"> =
  {
    active: "default",
    in_process: "secondary",
    completed: "secondary",
    cancelled: "destructive",
    canceled: "destructive",
    pending: "secondary",
    draft: "outline",
    proposed: "secondary",
    changes_requested: "secondary",
    approved: "default",
    rejected: "destructive",
    archived: "outline",
    not_ready: "outline",
    ready_to_publish: "secondary",
    publishing: "secondary",
    published: "default",
    publish_failed: "destructive",
    paused: "outline",
    ready_for_review: "default",
    needs_attention: "secondary",
    high_risk: "destructive",
    low: "outline",
    medium: "secondary",
    high: "destructive",
    urgent: "destructive",
    candidate: "secondary",
    winner: "default",
    loser: "outline",
    insufficient_data: "outline",
    manual_only: "outline",
    not_supported: "outline",
    live: "default",
    mixed: "secondary",
    manual: "outline",
    limited: "outline",
    up: "default",
    down: "destructive",
    flat: "outline",
    paid: "default",
    refunded: "secondary",
    failed: "destructive",
  };

export default function StateBadge({ value }: { value: string }) {
  const v = (value || "").toLowerCase();
  return (
    <Badge variant={MAP[v] || "outline"}>{value.replace(/_/g, " ")}</Badge>
  );
}
