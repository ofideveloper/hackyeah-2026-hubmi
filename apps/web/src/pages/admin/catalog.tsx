import { AdminCatalogView } from "@/components/admin/AdminCatalogView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminCatalogPage() {
  return (
    <AdminShell
      title="Katalog projektów"
      description="Projekty zapisane w bazie (Biblioteka Innowacji) — to z nich opiekun dobiera rozwiązania w czacie."
    >
      <AdminCatalogView />
    </AdminShell>
  );
}
