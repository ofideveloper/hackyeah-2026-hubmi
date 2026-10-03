import type { Conversation } from "@/lib/api";
import { formatDateTime, THREAD_KIND_LABEL, THREAD_STATUS } from "@/lib/communication";

type ThreadListProps = {
  threads: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
};

/** Lista rozmów — wspólna dla `/kontakt` i skrzynki ROPS w panelu admina. */
export function ThreadList({ threads, selectedId, onSelect, emptyText }: ThreadListProps) {
  if (threads.length === 0) {
    return <p className="kb-card text-sm text-[var(--muted)]">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {threads.map((thread) => {
        const state = THREAD_STATUS[thread.status];
        return (
          <li key={thread.id}>
            <button
              type="button"
              className="kb-card kb-card-button thread-item"
              aria-current={thread.id === selectedId ? "true" : undefined}
              onClick={() => onSelect(thread.id)}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="kb-meta">{THREAD_KIND_LABEL[thread.kind]}</span>
                {/* „Nowe” jako tekst — nie sam kolor */}
                {thread.unread && <span className="thread-unread">Nowe</span>}
              </span>
              <span className="font-display text-base font-semibold leading-snug">
                {thread.subject}
              </span>
              <span className="text-sm text-[var(--muted)]">
                {[thread.counterpart_name, formatDateTime(thread.last_message_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span>
                <span className={state.className}>{state.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
