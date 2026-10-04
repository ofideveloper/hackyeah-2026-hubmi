import { useEffect, useId, useState, type ReactNode } from "react";

import { InfoNote } from "@/components/boxes";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { useAuth } from "@/hooks/useAuth";
import {
  askIdeaAssistant,
  type IdeaAssistantAction,
  type IdeaAssistantDraft,
  type IdeaAssistantReply,
  type IdeaInput,
} from "@/lib/api";

const ACTIONS: {
  action: IdeaAssistantAction;
  label: string;
  hint: string;
  needsQuestion?: boolean;
}[] = [
  {
    action: "develop",
    label: "Rozwiń pomysł",
    hint: "Uzupełni puste pola fiszki (opis, istota, dla kogo).",
  },
  {
    action: "unconventional",
    label: "Nietuzinkowe warianty",
    hint: "Pokaże odważniejsze pomysły - możesz wstawić je wykorzystać.",
  },
  {
    action: "canvas",
    label: "Wypełnij puste pola",
    hint: "Uzupełni puste pola w canvie innowacji społecznej.",
  },
  {
    action: "visualize",
    label: "Zwizualizuj",
    hint: "Narysuje prosty szkic pomysłu.",
  },
  {
    action: "ask",
    label: "Zapytaj asystenta",
    hint: "Zadaj własne pytanie o pomysł i porozmawiaj.",
    needsQuestion: true,
  },
];

/** Zgodne z `minLength` pola tytułu w formularzu fiszki. */
const TITLE_MIN = 2;

type IdeaAssistantProps = {
  idea: IdeaInput;
  onCanvas: (canvas: Record<string, string>) => number;
  onDraft: (draft: IdeaAssistantDraft) => number;
  /** Czy da się cofnąć ostatnie wstawienie do formularza. */
  canUndoFill?: boolean;
  onUndoFill?: () => void;
};

type PanelBodyProps = {
  titleId: string;
  questionId: string;
  choiceGroupId: string;
  titleReady: boolean;
  selected: IdeaAssistantAction | null;
  onSelect: (action: IdeaAssistantAction) => void;
  question: string;
  setQuestion: (value: string) => void;
  busy: boolean;
  error: string | null;
  notice: string | null;
  result: IdeaAssistantReply | null;
  ideaName: string;
  canUndo: boolean;
  onRun: () => void;
  onApplyEssence: () => void;
  onUndo: () => void;
  headerExtra?: ReactNode;
};

function PanelBody({
  titleId,
  questionId,
  choiceGroupId,
  titleReady,
  selected,
  onSelect,
  question,
  setQuestion,
  busy,
  error,
  notice,
  result,
  ideaName,
  canUndo,
  onRun,
  onApplyEssence,
  onUndo,
  headerExtra,
}: PanelBodyProps) {
  const selectedMeta = ACTIONS.find((item) => item.action === selected) ?? null;
  const needsQuestion = Boolean(selectedMeta?.needsQuestion);
  const canRun =
    Boolean(selectedMeta) && !busy && (!needsQuestion || question.trim().length > 0);

  return (
    <>
      <div className="idea-assistant-head">
        <div>
          <p className="kb-meta">Asystent kreatora</p>
          <h2 id={titleId} className="font-display mt-1 text-lg font-semibold">
            Rozwiń pomysł z AI
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {titleReady
              ? "Wybierz opcję, potem naciśnij „Uruchom”. Nic nie startuje samo."
              : "Wpisz tytuł pomysłu i pozostałe pola formularza, sprawdź pomysły asystenta."}
          </p>
        </div>
        {headerExtra}
      </div>

      <div
        className="idea-assistant-choice-list"
        role="radiogroup"
        aria-labelledby={choiceGroupId}
        aria-disabled={!titleReady || busy}
      >
        <p id={choiceGroupId} className="idea-assistant-step-label">
          Co ma zrobić asystent?
        </p>
        {ACTIONS.map((item) => {
          const active = selected === item.action;
          return (
            <button
              key={item.action}
              type="button"
              role="radio"
              aria-checked={active}
              className={`idea-assistant-choice${active ? " is-selected" : ""}`}
              disabled={!titleReady || busy}
              onClick={() => onSelect(item.action)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {selectedMeta && (
        <div className="idea-assistant-next space-y-3">
          <InfoNote label="Co się wydarzy?">{selectedMeta.hint}</InfoNote>

          <div className="space-y-3 pt-3">
            <label htmlFor={questionId} className="block text-sm font-medium">
              {needsQuestion
                ? "Twoje pytanie"
                : "Wskazówka (opcjonalnie)"}
            </label>
            <textarea
              id={questionId}
              className="field min-h-16"
              maxLength={1000}
              placeholder={
                needsQuestion
                  ? "np. Jak dotrzeć do seniorów na wsi?"
                  : "np. Skup się na seniorach na wsi"
              }
              value={question}
              disabled={busy}
              required={needsQuestion}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <button
              type="button"
              className="btn-primary idea-assistant-run"
              disabled={!canRun}
              onClick={onRun}
            >
              {busy
                ? "Asystent pracuje…"
                : needsQuestion
                  ? "Zapytaj"
                  : `Uruchom: ${selectedMeta.label}`}
            </button>
          </div>
        </div>
      )}

      {busy && (
        <InfoNote label="Chwila" tone="muted">
          Asystent przygotowuje odpowiedź — to może chwilę potrwać.
        </InfoNote>
      )}

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {notice && (
          <InfoNote label="Gotowe" tone="success" className="mb-3">
            {notice}
          </InfoNote>
        )}
        {result?.svg ? (
          <figure>
            {/* SVG z modelu tylko jako obraz (data URI) — w <img> nie wykona się żaden skrypt */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`}
              alt={`Szkic wizualizacji pomysłu${ideaName ? `: ${ideaName}` : ""}`}
              className="w-full rounded-xl border border-[var(--border)] bg-white"
            />
            <figcaption className="mt-2 text-xs text-[var(--muted)]">
              Poglądowy szkic wygenerowany przez AI.
            </figcaption>
          </figure>
        ) : (
          result && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-sm">
                <ChatMarkdown content={result.reply} />
              </div>
              <button type="button" className="btn-ghost" onClick={onApplyEssence}>
                Wstaw do pola „Istota pomysłu”
              </button>
            </div>
          )
        )}
        {canUndo && (
          <div className="mt-3">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={onUndo}
            >
              Cofnij podpowiedź
            </button>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Przywróci formularz sprzed ostatniej propozycji asystenta albo schowa
              odpowiedź poniżej.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/** Asystent kreatora innowacji: podpowiedzi do fiszki i szkic wizualizacji (SVG). */
export function IdeaAssistant({
  idea,
  onCanvas,
  onDraft,
  canUndoFill = false,
  onUndoFill,
}: IdeaAssistantProps) {
  const { canUseSession } = useAuth();
  const questionId = useId();
  const titleId = useId();
  const panelId = useId();
  const choiceGroupId = useId();
  const [selected, setSelected] = useState<IdeaAssistantAction | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<IdeaAssistantReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Odpowiedź w panelu (pytanie / wizualizacja), którą też można schować. */
  const [canDismissResult, setCanDismissResult] = useState(false);

  const titleReady = idea.name.trim().length >= TITLE_MIN;

  useEffect(() => {
    if (!titleReady) {
      setMobileOpen(false);
      setSelected(null);
    }
  }, [titleReady]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function run(action: IdeaAssistantAction) {
    if (busy || !titleReady) return;
    if (!canUseSession) {
      setError("Zaloguj się, żeby korzystać z asystenta.");
      return;
    }
    if (action === "ask" && !question.trim()) {
      setError("Wpisz pytanie do asystenta.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const reply = await askIdeaAssistant(action, idea, question.trim());
      if (reply.draft) {
        const filled = onDraft(reply.draft);
        setNotice(
          filled > 0
            ? `Uzupełniono pola fiszki: ${filled}. Jeśli nie pasują — użyj „Cofnij podpowiedź”.`
            : "Wszystkie pola fiszki są już wypełnione — wyczyść pole, aby dostać propozycję.",
        );
        setResult(null);
        setCanDismissResult(false);
      } else if (reply.canvas) {
        const filled = onCanvas(reply.canvas);
        setNotice(
          filled > 0
            ? `Uzupełniono pola canvy: ${filled}. Jeśli nie pasują — użyj „Cofnij podpowiedź”.`
            : "Wszystkie pola canvy są już wypełnione — wyczyść pole, aby dostać propozycję.",
        );
        setResult(null);
        setCanDismissResult(false);
      } else {
        setResult(reply);
        setCanDismissResult(true);
      }
      if (action === "ask") setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asystent nie odpowiedział");
    } finally {
      setBusy(false);
    }
  }

  function applyReplyToEssence() {
    const text = result?.reply?.trim();
    if (!text) return;
    const filled = onDraft({
      name: "",
      description: "",
      essence: text,
      audience: "",
    });
    setNotice(
      filled > 0
        ? "Wstawiono odpowiedź asystenta do pola „Istota pomysłu”. Możesz to cofnąć."
        : "Pole „Istota pomysłu” jest już wypełnione — wyczyść je, aby wstawić odpowiedź.",
    );
    if (filled > 0) setCanDismissResult(false);
  }

  function undoSuggestion() {
    if (canUndoFill) onUndoFill?.();
    if (canDismissResult || result) {
      setResult(null);
      setCanDismissResult(false);
    }
    setNotice(
      canUndoFill
        ? "Cofnięto podpowiedź — formularz wrócił do poprzedniego stanu."
        : "Schowano odpowiedź asystenta.",
    );
  }

  const canUndo = canUndoFill || canDismissResult || Boolean(result);

  const bodyProps: Omit<PanelBodyProps, "headerExtra"> = {
    titleId,
    questionId,
    choiceGroupId,
    titleReady,
    selected,
    onSelect: setSelected,
    question,
    setQuestion,
    busy,
    error,
    notice,
    result,
    ideaName: idea.name,
    canUndo,
    onRun: () => {
      if (selected) void run(selected);
    },
    onApplyEssence: applyReplyToEssence,
    onUndo: undoSuggestion,
  };

  const rootClass = [
    "idea-assistant-root",
    titleReady ? "is-ready" : "",
    mobileOpen ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <section
        id={panelId}
        className="idea-assistant-panel surface space-y-4 p-5"
        aria-labelledby={titleId}
      >
        <PanelBody
          {...bodyProps}
          headerExtra={
            <button
              type="button"
              className="idea-assistant-dock-hide"
              onClick={() => setMobileOpen(false)}
            >
              Ukryj
            </button>
          }
        />
      </section>

      {titleReady ? (
        <button
          type="button"
          className="idea-assistant-dock-toggle"
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="idea-assistant-dock-toggle-text">
            <span className="idea-assistant-dock-kicker">Asystent AI</span>
            <span className="idea-assistant-dock-label">Rozwiń pomysł z AI</span>
          </span>
          <span className="idea-assistant-dock-chevron" aria-hidden="true" />
          <span className="sr-only">
            {mobileOpen ? "Ukryj asystenta" : "Pokaż asystenta"}
          </span>
        </button>
      ) : (
        <p className="idea-assistant-dock-toggle idea-assistant-dock-status" role="status">
          <span className="idea-assistant-dock-toggle-text">
            <span className="idea-assistant-dock-kicker">Asystent AI</span>
            <span className="idea-assistant-dock-label">
              Wpisz tytuł, aby włączyć asystenta pomysłu
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
