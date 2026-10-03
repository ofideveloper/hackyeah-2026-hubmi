import { AdminShell } from "@/components/admin/AdminShell";
import { AdminUsersView } from "@/components/admin/AdminUsersView";

export default function AdminUsersPage() {
  return (
    <AdminShell title="Użytkownicy" description="Konta w systemie i ich role.">
      <AdminUsersView />
    </AdminShell>
  );
}
