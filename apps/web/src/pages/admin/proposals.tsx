import { AdminProposalsView } from "@/components/admin/AdminProposalsView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminProposalsPage() {
  return (
    <AdminShell
      title="Propozycje projektów"
      description="Potrzeby z czatu, na które baza nie miała odpowiedzi — zaakceptuj je albo odrzuć."
    >
      <AdminProposalsView />
    </AdminShell>
  );
}
