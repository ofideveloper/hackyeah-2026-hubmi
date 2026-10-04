import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminHomePage() {
  return (
    <AdminShell
      title="Przegląd"
      description="Skrót panelu — co czeka na decyzję i przejścia do sekcji."
    >
      <AdminOverview />
    </AdminShell>
  );
}
