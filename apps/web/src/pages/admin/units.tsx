import { AdminShell } from "@/components/admin/AdminShell";
import { AdminUnitsView } from "@/components/admin/AdminUnitsView";

export default function AdminUnitsPage() {
  return (
    <AdminShell
      title="Jednostki organizacyjne"
      description="Teren odpowiedzialności i kompetencje — baza pod projekty i sprawy."
    >
      <AdminUnitsView />
    </AdminShell>
  );
}
