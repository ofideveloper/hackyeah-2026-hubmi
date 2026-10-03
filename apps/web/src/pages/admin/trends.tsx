import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTrendsView } from "@/components/admin/AdminTrendsView";

export default function AdminTrendsPage() {
  return (
    <AdminShell
      title="Trendy potrzeb"
      description="Potrzeby zgłaszane opiekunowi, zagregowane według obszarów. Widok tylko dla administratora."
    >
      <AdminTrendsView />
    </AdminShell>
  );
}
