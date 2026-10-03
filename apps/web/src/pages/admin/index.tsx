import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminHomePage() {
  return (
    <AdminShell
      title="Przegląd"
      description="Skrót panelu — wybierz sekcję, żeby zarządzać jednostkami, projektami i sprawami."
    >
      <AdminOverview />
    </AdminShell>
  );
}
