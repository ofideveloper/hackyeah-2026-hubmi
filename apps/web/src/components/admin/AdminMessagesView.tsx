import { useState } from "react";

import { ThreadList } from "@/components/communication/ThreadList";
import { ThreadView } from "@/components/communication/ThreadView";
import { useThreads } from "@/hooks/useThreads";
import type { Conversation } from "@/lib/api";

type Filter = "nowe" | "otwarta" | "zamknieta" | null;

const FILTERS: { value: Filter; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "nowe", label: "Nowe" },
  { value: "otwarta", label: "Otwarte" },
  { value: "zamknieta", label: "Zamknięte" },
];

function matches(thread: Conversation, filter: Filter): boolean {
  if (filter === null) return true;
  return filter === "nowe" ? thread.unread : thread.status === filter;
}

/** Wspólna skrzynka zespołu ROPS — pytania użytkowników z `/kontakt`. */
export function AdminMessagesView() {
  const { threads, error, reload } = useThreads(true);
  const [filter, setFilter] = useState<Filter>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!threads) {
    return error ? (
      <p className="text-sm text-[var(--danger)]" role="alert">
        {error}
      </p>
    ) : (
      <p className="text-sm text-[var(--muted)]" role="status">Ładowanie…</p>
    );
  }

  // admin dostaje z API także własne rozmowy z mentorami i partnerami — tu tylko skrzynka ROPS
  const questions = threads.filter((thread) => thread.kind === "pytanie");
  const shown = questions.filter((thread) => matches(thread, filter));

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr rozmów">
        {FILTERS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            className="kb-chip"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label} ({questions.filter((thread) => matches(thread, value)).length})
          </button>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ThreadList
          threads={shown}
          selectedId={selectedId}
          onSelect={setSelectedId}
          emptyText={
            questions.length === 0
              ? "Nikt nie zadał jeszcze pytania."
              : "Brak rozmów pasujących do filtra."
          }
        />
        {selectedId && (
          <ThreadView key={selectedId} conversationId={selectedId} onChanged={reload} />
        )}
      </div>
    </div>
  );
}
