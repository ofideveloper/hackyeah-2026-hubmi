import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTestingView } from "@/components/admin/AdminTestingView";

export default function AdminTestingPage() {
  return (
    <AdminShell
      title="Zgłoszenia testerów i opinie"
      description="Zgłoszenia chętnych do testów oraz opinie o rozwiązaniach z /tester. Usunięta opinia znika z publicznej listy."
    >
      <AdminTestingView />
    </AdminShell>
  );
}
