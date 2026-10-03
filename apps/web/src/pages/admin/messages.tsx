import { AdminMessagesView } from "@/components/admin/AdminMessagesView";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminMessagesPage() {
  return (
    <AdminShell
      title="Wiadomości"
      description="Pytania użytkowników do zespołu ROPS z /kontakt. Skrzynka jest wspólna — odpowiedź widzi pytający jako „Zespół ROPS”."
    >
      <AdminMessagesView />
    </AdminShell>
  );
}
