import { AdminKnowledgeView } from "@/components/admin/AdminKnowledgeView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminKnowledgePage() {
  return (
    <AdminShell
      title="Zasobnik wiedzy"
      description="Raporty, diagnozy i materiały edukacyjne widoczne publicznie na stronie /wiedza."
    >
      <AdminKnowledgeView />
    </AdminShell>
  );
}
