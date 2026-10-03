import { AdminShell } from "@/components/admin/AdminShell";
import { AdminReportsView } from "@/components/admin/AdminReportsView";

export default function AdminReportsPage() {
  return (
    <AdminShell
      title="Sprawy mieszkańców"
      description="Sprawy otwiera AI / system — tutaj ustawiasz status widoczny dla mieszkańca."
    >
      <AdminReportsView />
    </AdminShell>
  );
}
