import { AdminIdeasView } from "@/components/admin/AdminIdeasView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminIdeasPage() {
  return (
    <AdminShell
      title="Fiszki pomysłów"
      description="Pomysły zgłoszone w Kreatorze. Odrzucona fiszka znika z publicznej listy na /kreator."
    >
      <AdminIdeasView />
    </AdminShell>
  );
}
