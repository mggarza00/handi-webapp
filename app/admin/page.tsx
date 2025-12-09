import DashboardMetrics from "@/components/admin/DashboardMetrics.client";
import CriticalPendings from "@/components/admin/CriticalPendings.client";

export default async function AdminPage() {
  return (
    <main className="space-y-6">
      <DashboardMetrics />

      <section className="rounded-xl border p-4">
        <CriticalPendings />
      </section>
    </main>
  );
}
