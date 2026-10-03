import { AdminProposalsView } from "@/components/admin/AdminProposalsView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminProposalsPage() {
  return (
    <AdminShell
      title="Propozycje projektów"
      description="Opiekun zbiera z rozmowy materiał pod nowy projekt — Ty przydzielasz jednostkę i zatwierdzasz."
    >
      <AdminProposalsView />
    </AdminShell>
  );
}
