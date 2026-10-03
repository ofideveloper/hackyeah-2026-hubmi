import { AdminGrantCallsView } from "@/components/admin/AdminGrantCallsView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminGrantsPage() {
  return (
    <AdminShell
      title="Nabory grantowe"
      description="W terminie naboru w Kreatorze pomysłów pojawia się generator wniosków z pytaniami zdefiniowanymi tutaj."
    >
      <AdminGrantCallsView />
    </AdminShell>
  );
}
