/**
 * Czat mieszkańca - ciepły UX + karty projektów z modalem.
 * Bez export / import / zapisu rozmowy.
 */
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import { LocationRequestCard } from "@/components/LocationRequestCard";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { ProjectPreviewModal } from "@/components/ProjectPreviewModal";
import { ProjectSuggestionCards } from "@/components/ProjectSuggestionCards";
import { useAuth } from "@/hooks/useAuth";
import {
  boostChatInterest,
  sendChatMessage,
  type ChatIdea,
  type ChatProject,
  type LocationRequestKind,
  type NewProjectDraft,
  type ProjectProposal,
  type SimilarCases,
} from "@/lib/api";

export type ChatRole = "user" | "assistant" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  suggestedProjects?: ChatProject[];
  suggestedIdeas?: ChatIdea[];
  similar?: SimilarCases | null;
  newProjectDraft?: NewProjectDraft | null;
  projectProposal?: ProjectProposal | null;
  locationRequest?: LocationRequestKind | null;
  locationResolved?: boolean;
  /** Treść ostatniej wiadomości użytkownika — do „Spróbuj ponownie” przy błędzie API. */
  retryText?: string;
};

const CARETAKER = "Twój interaktywny asystent";

/** Deterministic HH:MM - avoids Node vs browser `toLocaleTimeString` mismatches. */
function formatClock(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function needsLabel(count: number): string {
  if (count === 1) return "1 podobną potrzebę";
  const few =
    count % 10 >= 2 &&
    count % 10 <= 4 &&
    (count % 100 < 12 || count % 100 > 14);
  return `${count} ${few ? "podobne potrzeby" : "podobnych potrzeb"}`;
}

/** Zasugerowane projekty z przyciskiem podbicia — bez dublowania w „podobnych”. */
function SuggestedProjectsWithBoost({
  projects,
  chatId,
  onOpen,
  onProjectsChange,
}: {
  projects: ChatProject[];
  chatId: string | null;
  onOpen: (project: ChatProject) => void;
  onProjectsChange: (next: ChatProject[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function boost(projectId: string) {
    if (busyId) return;
    setBusyId(projectId);
    try {
      const result = await boostChatInterest({
        chat_id: chatId,
        project_id: projectId,
      });
      onProjectsChange(
        projects.map((project) =>
          project.id === result.target_id
            ? { ...project, interest_count: result.interest_count }
            : project,
        ),
      );
    } catch {
      // cicho — podbicie jest opcjonalne; błąd nie blokuje przeglądania
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ProjectSuggestionCards
      projects={projects}
      onOpen={onOpen}
      busyId={busyId}
      onBoost={boost}
    />
  );
}

/** Zatwierdzone pomysły z Kreatora — podbicie bez otwierania katalogu ROPS. */
function SuggestedIdeasWithBoost({
  ideas,
  chatId,
  onIdeasChange,
}: {
  ideas: ChatIdea[];
  chatId: string | null;
  onIdeasChange: (next: ChatIdea[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ideas.length) return null;

  async function boost(ideaId: string) {
    if (busyId) return;
    setBusyId(ideaId);
    setError(null);
    try {
      const result = await boostChatInterest({
        chat_id: chatId,
        idea_id: ideaId,
      });
      onIdeasChange(
        ideas.map((idea) =>
          idea.id === result.target_id
            ? { ...idea, interest_count: result.interest_count }
            : idea,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się podbić");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full">
      <ProjectSuggestionCards
        projects={ideas.map((idea) => ({
          id: idea.id,
          name: idea.name,
          description: idea.description,
          unit_name: "Pomysł z Kreatora",
          interest_count: idea.interest_count,
        }))}
        label="Zatwierdzone pomysły"
        busyId={busyId}
        onBoost={boost}
      />
      <Link
        href="/kreator#pomysly"
        className="kb-link mt-2 inline-block text-[0.8125rem]"
      >
        Zobacz pomysły w Kreatorze
      </Link>
      {error && (
        <p className="mt-2 text-[0.8125rem] text-[var(--danger, #b42318)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Podobne przypadki — kompaktowo: liczba potrzeb (fiszki są w osobnej sekcji). */
function SimilarCasesNote({
  similar,
}: {
  similar: SimilarCases;
}) {
  if (similar.needs_last_30_days <= 0) {
    return null;
  }

  return (
    <div
      className="project-draft-note"
      role="group"
      aria-label="Podobne przypadki"
    >
      <p className="project-draft-note-label">Podobne przypadki</p>
      <p className="project-draft-note-text mt-1.5">
        W ostatnich 30 dniach: {needsLabel(similar.needs_last_30_days)}
        {similar.area_name ? ` w obszarze „${similar.area_name}”` : ""}.
      </p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1.5 py-0.5"
      aria-label={`${CARETAKER} pisze`}
    >
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
    </div>
  );
}

function CaretakerMark({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const icon = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div
      className={`chat-caretaker-avatar flex shrink-0 items-center justify-center rounded-full ${dim}`}
      aria-hidden
    >
      <svg
        className={icon}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="11" cy="11" r="3.2" fill="currentColor" opacity="0.95" />
        <circle cx="21" cy="11" r="3.2" fill="currentColor" opacity="0.95" />
        <path
          d="M6.5 22.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M14.5 22.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M16 26.2c-.35-.28-2.2-1.55-2.9-3-.7-1.5-.3-2.7.8-3 .6-.15 1.15.1 1.55.55.4-.45.95-.7 1.55-.55 1.1.3 1.5 1.5.8 3-.7 1.45-2.55 2.72-2.9 3Z"
          fill="#e8f1fa"
        />
      </svg>
    </div>
  );
}

type AssistantChatProps = {
  userName?: string | null;
  /** Czat na landingu - działa bez logowania */
  guestMode?: boolean;
  /** Ustaw focus na polu wiadomości (np. po nawigacji do `#opiekun`) */
  autoFocus?: boolean;
};

function welcomeMessage(guestMode: boolean): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: guestMode
      ? `Miło Cię widzieć. Opisz sprawę własnymi słowami - pomogę znaleźć kierunek albo gotowe rozwiązanie.`
      : `Miło Cię widzieć. Jestem Twoim interaktywnym asystentem. Opisz, co się dzieje - razem pomyślimy nad rozwiązaniem.`,
    timestamp: new Date(),
  };
}

export function AssistantChat({
  userName,
  guestMode = false,
  autoFocus = false,
}: AssistantChatProps) {
  const { canUseSession } = useAuth();
  const displayName = userName?.trim() || "mieszkańcu";
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    welcomeMessage(guestMode),
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<ChatProject | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  /** Otwarte okno nowego projektu - `messageId` wskazuje wiadomość ze szkicem. */
  const [draftDialog, setDraftDialog] = useState<{
    messageId: string;
    draft: NewProjectDraft;
  } | null>(null);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  /** Gate locale/clock UI until after hydration (SSR `new Date()` ≠ client). */
  const [clockReady, setClockReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const onlyWelcome = messages.length === 1 && messages[0]?.id === "welcome";

  function startNewChat() {
    if (busy || onlyWelcome) return;
    setMessages([welcomeMessage(guestMode)]);
    setInput("");
    setPreview(null);
    setChatId(null);
    setDraftDialog(null);
    setLocatingId(null);
  }

  useEffect(() => {
    setClockReady(true);
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, locatingId]);

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (!guestMode && !canUseSession) return;

    const history = messages
      .filter(
        (m) =>
          m.id !== "welcome" &&
          (m.role === "user" || m.role === "assistant") &&
          m.content.trim(),
      )
      .slice(-24)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await requestAssistantReply(trimmed, history);
  }

  /** Ponawia ostatnią nieudaną wiadomość — bez nowego bąbelka usera i bez resetu chat_id. */
  async function retryFailed(errorId: string) {
    if (busy) return;
    if (!guestMode && !canUseSession) return;

    const errorMsg = messages.find((m) => m.id === errorId);
    const retryText = errorMsg?.retryText?.trim();
    if (!retryText) return;

    const withoutError = messages.filter((m) => m.id !== errorId);
    let lastUserIndex = -1;
    for (let i = withoutError.length - 1; i >= 0; i -= 1) {
      const row = withoutError[i];
      if (row.role === "user" && row.content === retryText) {
        lastUserIndex = i;
        break;
      }
    }
    const historySource =
      lastUserIndex >= 0 ? withoutError.slice(0, lastUserIndex) : withoutError;
    const history = historySource
      .filter(
        (m) =>
          m.id !== "welcome" &&
          (m.role === "user" || m.role === "assistant") &&
          m.content.trim(),
      )
      .slice(-24)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    setMessages(withoutError);
    await requestAssistantReply(retryText, history);
  }

  async function requestAssistantReply(
    trimmed: string,
    history: { role: "user" | "assistant"; content: string }[],
  ) {
    setBusy(true);
    try {
      const {
        reply,
        suggested_projects,
        suggested_ideas,
        project_proposal,
        location_request,
        chat_id,
        new_project_draft,
        similar,
      } = await sendChatMessage(trimmed, history, null, chatId);
      setChatId(chat_id);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
          suggestedProjects: suggested_projects,
          suggestedIdeas: suggested_ideas,
          similar,
          newProjectDraft: new_project_draft,
          projectProposal: project_proposal,
          locationRequest: location_request,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "error",
          content:
            err instanceof Error
              ? err.message
              : "Nie udało się uzyskać odpowiedzi",
          timestamp: new Date(),
          retryText: trimmed,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function markLocationResolved(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, locationResolved: true } : m,
      ),
    );
  }

  async function shareGps(messageId: string, kind: LocationRequestKind) {
    if (busy || locatingId) return;
    if (!navigator.geolocation) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "error",
          content:
            "To urządzenie nie obsługuje udostępniania lokalizacji - wpisz adres ręcznie.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setLocatingId(messageId);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const maps = `https://maps.google.com/?q=${latitude},${longitude}`;
        const label =
          kind === "gps"
            ? "Moja aktualna lokalizacja"
            : "Lokalizacja miejsca (z GPS urządzenia)";
        const text =
          `${label}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` +
          ` (±${Math.round(accuracy)} m). Mapa: ${maps}`;
        markLocationResolved(messageId);
        setLocatingId(null);
        void submitMessage(text);
      },
      (err) => {
        setLocatingId(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "error",
            content:
              err.code === err.PERMISSION_DENIED
                ? "Brak zgody na lokalizację - możesz wpisać ulicę lub dzielnicę ręcznie."
                : "Nie udało się pobrać lokalizacji - spróbuj wpisać adres ręcznie.",
            timestamp: new Date(),
          },
        ]);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <section className="chat-shell animate-fade-up overflow-hidden">
      <header className="chat-shell-header px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
        <div className="flex items-start gap-4">
          <CaretakerMark />
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-text)]">
              {CARETAKER}
            </p>
            <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
              {guestMode
                ? "Cześć - w czym mogę pomóc?"
                : `Witaj, ${displayName}`}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              {guestMode
                ? "Napisz, co się dzieje — razem znajdziemy sensowny kierunek."
                : "Opowiedz, co Cię zajmuje - razem pomyślimy nad rozwiązaniem."}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="chat-thread max-h-[480px] min-h-[260px] space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.map((message, index) => {
          const prev = messages[index - 1];
          const isCaretaker = message.role !== "user";
          const showMark = isCaretaker && (!prev || prev.role === "user");
          const hasProjects =
            message.role === "assistant" &&
            (message.suggestedProjects?.length ?? 0) > 0;
          const hasIdeas =
            message.role === "assistant" &&
            (message.suggestedIdeas?.length ?? 0) > 0;
          return (
            <div
              key={message.id}
              data-role={message.role}
              className="animate-soft-in"
            >
              <div
                className={`flex items-end gap-2.5 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {isCaretaker &&
                  (showMark ? (
                    <CaretakerMark size="sm" />
                  ) : (
                    <div className="w-9 shrink-0" aria-hidden />
                  ))}
                <div
                  className={`max-w-[min(100%,28rem)] ${
                    message.role === "user" ? "items-end" : "items-start"
                  } flex w-full flex-col`}
                >
                  <div
                    className={`px-4 py-3 text-[0.9375rem] leading-relaxed ${
                      message.role === "user"
                        ? "chat-bubble-user"
                        : message.role === "error"
                          ? "chat-bubble-error"
                          : "chat-bubble-caretaker"
                    }`}
                  >
                    <ChatMarkdown
                      content={message.content}
                      variant={
                        message.role === "user"
                          ? "user"
                          : message.role === "error"
                            ? "error"
                            : "caretaker"
                      }
                    />
                  </div>

                  {message.role === "error" && message.retryText && (
                    <button
                      type="button"
                      className="btn-ghost mt-2 self-start text-[0.8125rem]"
                      disabled={busy}
                      onClick={() => void retryFailed(message.id)}
                    >
                      Spróbuj ponownie
                    </button>
                  )}

                  {hasProjects && (
                    <SuggestedProjectsWithBoost
                      projects={message.suggestedProjects!}
                      chatId={chatId}
                      onOpen={setPreview}
                      onProjectsChange={(next) => {
                        setMessages((prev) =>
                          prev.map((row) =>
                            row.id === message.id
                              ? { ...row, suggestedProjects: next }
                              : row,
                          ),
                        );
                      }}
                    />
                  )}

                  {hasIdeas && (
                    <SuggestedIdeasWithBoost
                      ideas={message.suggestedIdeas!}
                      chatId={chatId}
                      onIdeasChange={(next) => {
                        setMessages((prev) =>
                          prev.map((row) =>
                            row.id === message.id
                              ? { ...row, suggestedIdeas: next }
                              : row,
                          ),
                        );
                      }}
                    />
                  )}

                  {message.similar && (
                    <SimilarCasesNote similar={message.similar} />
                  )}

                  {message.newProjectDraft && !message.projectProposal && (
                    <div
                      className="report-offer-card"
                      role="group"
                      aria-label="Nowy projekt"
                    >
                      <p className="report-offer-text">
                        Nie znalazłem tego w bazie - możesz zgłosić propozycję
                        nowego projektu.
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          setDraftDialog({
                            messageId: message.id,
                            draft: message.newProjectDraft!,
                          })
                        }
                      >
                        Zgłoś nowy projekt
                      </button>
                    </div>
                  )}

                  {message.projectProposal && (
                    <div className="project-draft-note" role="status">
                      <p className="project-draft-note-label">
                        Propozycja dla zespołu
                      </p>
                      <p className="font-display project-draft-note-title">
                        {message.projectProposal.name}
                      </p>
                      <p className="project-draft-note-text">
                        Przekazałem to zespołowi ROPS - odezwie się, gdy oceni
                        propozycję.
                      </p>
                    </div>
                  )}

                  {message.locationRequest && !message.locationResolved && (
                    <LocationRequestCard
                      kind={message.locationRequest}
                      busy={locatingId === message.id || busy}
                      onShareGps={() =>
                        void shareGps(message.id, message.locationRequest!)
                      }
                      onSkip={() => markLocationResolved(message.id)}
                    />
                  )}

                  <p
                    className={`mt-1.5 px-1 text-xs text-[var(--muted)] ${
                      message.role === "user" ? "self-end" : "self-start"
                    }`}
                    suppressHydrationWarning
                  >
                    {clockReady ? formatClock(message.timestamp) : "\u00a0"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-end gap-2.5">
            <CaretakerMark size="sm" />
            <div className="chat-bubble-caretaker px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="chat-composer border-t border-[var(--border)] px-4 py-4 sm:px-6"
      >
        <div className="flex items-start gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Twoja wiadomość</span>
            <textarea
              id="chat-message-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              disabled={busy}
              placeholder="Napisz, czego potrzebujesz…"
              className="chat-input"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="chat-send"
            aria-label="Wyślij wiadomość"
            title="Wyślij"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">
            Enter wysyła · Shift+Enter nowa linia
          </p>
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy || onlyWelcome}
            className="btn-ghost inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 py-0 text-xs font-medium leading-none"
            title="Zacznij nową sprawę - wyczyść rozmowę"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              <path d="m9.5 8.5 5 5" />
              <path d="m14.5 8.5-5 5" />
            </svg>
            Nowa sprawa
          </button>
        </div>
      </form>

      {preview && (
        <ProjectPreviewModal
          project={preview}
          chatId={chatId}
          onClose={() => setPreview(null)}
        />
      )}

      {draftDialog && (
        <NewProjectDialog
          draft={draftDialog.draft}
          guestMode={guestMode}
          onClose={() => setDraftDialog(null)}
          onCreated={(proposal) => {
            const { messageId } = draftDialog;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId ? { ...m, projectProposal: proposal } : m,
              ),
            );
            setDraftDialog(null);
          }}
        />
      )}
    </section>
  );
}
