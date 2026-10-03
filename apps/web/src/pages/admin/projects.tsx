import { AdminShell } from "@/components/admin/AdminShell";
import { AdminProjectsView } from "@/components/admin/AdminProjectsView";

export default function AdminProjectsPage() {
  return (
    <AdminShell
      title="Projekty"
      description="Twórz projekty i przydzielaj je do jednostek — AI może je sugerować w rozmowie."
    >
      <AdminProjectsView />
    </AdminShell>
  );
}
