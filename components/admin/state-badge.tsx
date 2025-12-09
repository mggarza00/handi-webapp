import { Badge } from "@/components/ui/badge";

const MAP: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  in_process: "secondary",
  completed: "secondary",
  cancelled: "destructive",
  canceled: "destructive",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "default",
  refunded: "secondary",
  failed: "destructive",
};

export default function StateBadge({ value }: { value: string }) {
  const v = (value || "").toLowerCase();
  return <Badge variant={MAP[v] || "outline"}>{value.replace(/_/g, " ")}</Badge>;
}

