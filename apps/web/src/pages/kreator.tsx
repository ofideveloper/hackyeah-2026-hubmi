/**
 * Kreator pomysłów — fiszki innowacji społecznych, canva, asystent AI
 * i (tylko w trakcie naboru) generator wniosków. Lista pomysłów jest publiczna,
 * tworzenie wymaga logowania.
 */
import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { GrantApplicationForm } from "@/components/creator/GrantApplicationForm";
import { IdeaAssistant } from "@/components/creator/IdeaAssistant";
import { SiteHeader } from "@/components/SiteHeader";
import { Toast } from "@/components/Toast";
import {
  deleteIdea,
  fetchIdeas,
  fetchKnowledge,
  fetchMe,
  fetchMyIdeas,
  fetchOpenGrantCalls,
  saveIdea,
  type GrantCall,
  type Idea,
  type IdeaInput,
  type IdeaStage,
  type KnowledgeArea,
  type MyIdea,
  type User,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { CANVAS_FIELDS, EMPTY_IDEA, formatDate, STAGE_LABEL } from "@/lib/ideas";

const STAGES = Object.keys(STAGE_LABEL) as IdeaStage[];

function IdeaCard({ idea, children }: { idea: Idea; children?: React.ReactNode }) {
  return (
    <li className="kb-card flex flex-col gap-2">
      <p className="kb-meta">
        {[STAGE_LABEL[idea.stage] ?? idea.stage, idea.category_name].filter(Boolean).join(" · ")}
      </p>
      <h3 className="font-display text-base font-semibold leading-snug">{idea.name}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
        {idea.description}
      </p>
      {idea.essence && (
        <p className="whitespace-pre-line text-sm leading-relaxed">
          <span className="font-semibold">Istota: </span>
          {idea.essence}
        </p>
      )}
      {idea.audience && (
        <p className="whitespace-pre-line text-sm leading-relaxed">
          <span className="font-semibold">Dla kogo: </span>
          {idea.audience}
        </p>
      )}
      <p className="mt-auto pt-1 text-xs text-[var(--muted)]">
        {[idea.author_name, formatDate(idea.created_at)].filter(Boolean).join(" · ")}
      </p>
      {children}
    </li>
  );
}

export default function IdeaCreatorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [myIdeas, setMyIdeas] = useState<MyIdea[]>([]);
  const [calls, setCalls] = useState<GrantCall[]>([]);
  const [areas, setAreas] = useState<KnowledgeArea[]>([]);
  const [form, setForm] = useState<IdeaInput>(EMPTY_IDEA);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<IdeaStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const fail = (err: unknown) =>
      setError(err instanceof Error ? err.message : "Nie udało się pobrać danych");
    fetchIdeas().then(setIdeas).catch(fail);
    fetchOpenGrantCalls().then(setCalls).catch(fail);
    // obszary są tylko opcjonalnym polem fiszki — brak nie blokuje kreatora
    fetchKnowledge()
      .then((data) => setAreas(data.areas))
      .catch(() => undefined);

    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetchMe(token)
      .then(async (me) => {
        setUser(me);
        setMyIdeas(await fetchMyIdeas(token));
      })
      .catch(() => clearToken())
      .finally(() => setAuthChecked(true));
  }, []);

  function resetForm() {
    setForm(EMPTY_IDEA);
    setEditingId(null);
  }

  function startEdit(idea: MyIdea) {
    setError(null);
    setEditingId(idea.id);
    setForm({
      name: idea.name,
      description: idea.description,
      essence: idea.essence,
      audience: idea.audience,
      stage: idea.stage,
      category_id: idea.category_id,
      canvas: idea.canvas,
    });
    document.getElementById("fiszka")?.scrollIntoView({ block: "start" });
  }

  /** Wstawia propozycje asystenta tylko w puste pola canvy — nie nadpisuje notatek autora. */
  function fillCanvas(suggested: Record<string, string>): number {
    const empty = CANVAS_FIELDS.filter(
      (field) => suggested[field.key] && !form.canvas[field.key]?.trim(),
    );
    if (empty.length > 0) {
      setForm((prev) => ({
        ...prev,
        canvas: {
          ...prev.canvas,
          ...Object.fromEntries(empty.map((field) => [field.key, suggested[field.key]])),
        },
      }));
      document.getElementById("canva")?.scrollIntoView({ block: "start" });
    }
    return empty.length;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const saved = await saveIdea(token, form, editingId);
      setMyIdeas((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setIdeas((prev) =>
        editingId
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...prev],
      );
      setToast(
        editingId ? "Zapisano zmiany w fiszce." : `Fiszka „${saved.name}” została utworzona.`,
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać fiszki");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(idea: MyIdea) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Usunąć fiszkę „${idea.name}”?`)) return;
    try {
      await deleteIdea(token, idea.id);
      setMyIdeas((prev) => prev.filter((item) => item.id !== idea.id));
      setIdeas((prev) => prev.filter((item) => item.id !== idea.id));
      if (editingId === idea.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć fiszki");
    }
  }

  const shownIdeas = ideas.filter((idea) => !stageFilter || idea.stage === stageFilter);

  return (
    <>
      <Head>
        <title>Kreator pomysłów · MaloHUB</title>
        <meta
          name="description"
          content="Zgłoś pomysł na innowację społeczną, rozwiń go z asystentem AI i złóż wniosek w naborze grantowym."
        />
      </Head>

      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <SiteHeader
        wide
        actions={
          <>
            <Link href="/wiedza" className="btn-ghost">
              Zasobnik wiedzy
            </Link>
            <Link href="/tester" className="btn-ghost">
              Tester innowacji
            </Link>
            <Link href="/kontakt" className="btn-ghost">
              Kontakt
            </Link>
            {user ? (
              <Link href="/app" className="btn-primary">
                Moja przestrzeń
              </Link>
            ) : (
              <Link href="/login" className="btn-primary">
                Zaloguj się
              </Link>
            )}
          </>
        }
      />

      <main id="tresc" className="kb-page mx-auto max-w-5xl px-6 pb-20 pt-10 sm:pt-14">
        <header className="animate-fade-up">
          <p className="kb-meta">Kreator pomysłów</p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Masz pomysł na <span className="text-[var(--accent)]">innowację społeczną</span>?
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Opisz go na krótkiej fiszce, dopracuj na canvie z pomocą asystenta i pokaż innym. W
            trakcie naborów grantowych złożysz tu także wniosek o finansowanie.
          </p>
        </header>

        {error && (
          <p className="mt-6 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        {calls.length > 0 && (
          <section className="kb-section" id="nabory" aria-labelledby="nabory-title">
            <h2 id="nabory-title" className="font-display kb-section-title">
              Trwające nabory
            </h2>
            <p className="kb-section-lead">
              Formularz wniosku jest dopasowany do każdego naboru. Szkic możesz zapisać i wrócić
              do niego przed terminem.
            </p>
            <div className="mt-5 space-y-4">
              {calls.map((call) =>
                user ? (
                  <GrantApplicationForm key={call.id} call={call} ideas={myIdeas} />
                ) : (
                  <article key={call.id} className="surface p-5">
                    <p className="kb-meta">Nabór otwarty do {formatDate(call.closes_on)}</p>
                    <h3 className="font-display mt-1 text-lg font-semibold">{call.title}</h3>
                    {call.description && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
                        {call.description}
                      </p>
                    )}
                    <Link href="/login" className="kb-link mt-3 inline-block">
                      Zaloguj się, aby złożyć wniosek
                    </Link>
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        <section className="kb-section" id="fiszka" aria-labelledby="fiszka-title">
          <h2 id="fiszka-title" className="font-display kb-section-title">
            {editingId ? "Edycja fiszki" : "Nowa fiszka pomysłu"}
          </h2>
          {!authChecked ? (
            <p className="kb-section-lead">Ładowanie…</p>
          ) : !user ? (
            <div className="surface mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
              <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                Żeby zgłosić pomysł, skorzystać z canvy i asystenta kreatora innowacji, zaloguj
                się lub załóż konto.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/login" className="btn-primary">
                  Zaloguj się
                </Link>
                <Link href="/register" className="btn-ghost">
                  Załóż konto
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
              <form onSubmit={onSubmit} className="surface space-y-4 p-5">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Tytuł pomysłu</span>
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    className="field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Krótki opis</span>
                  <textarea
                    required
                    minLength={2}
                    maxLength={1000}
                    className="field min-h-[88px]"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    Co jest istotą pomysłu?
                  </span>
                  <textarea
                    maxLength={2000}
                    className="field min-h-[88px]"
                    value={form.essence}
                    onChange={(e) => setForm({ ...form, essence: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Komu jest dedykowany?</span>
                  <textarea
                    maxLength={1000}
                    className="field min-h-[64px]"
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-[var(--muted)]">Etap realizacji</span>
                    <select
                      className="field"
                      value={form.stage}
                      onChange={(e) => setForm({ ...form, stage: e.target.value as IdeaStage })}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {STAGE_LABEL[stage]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-[var(--muted)]">Obszar</span>
                    <select
                      required
                      className="field"
                      value={form.category_id ?? ""}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
                    >
                      <option value="">Wybierz obszar</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset id="canva" className="scroll-mt-24 border-t border-[var(--border)] pt-4">
                  <legend className="font-display pr-3 text-base font-semibold">
                    Canva innowacji społecznej
                  </legend>
                  <p className="text-sm text-[var(--muted)]">
                    Robocze notatki do prototypowania — widzisz je tylko Ty. Więcej narzędzi
                    znajdziesz w{" "}
                    <Link href="/wiedza#materialy" className="kb-link">
                      materiałach edukacyjnych
                    </Link>
                    .
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {CANVAS_FIELDS.map((field) => (
                      <label key={field.key} className="block text-sm">
                        <span className="mb-1 block font-medium">{field.label}</span>
                        <span className="mb-1.5 block text-xs text-[var(--muted)]">
                          {field.hint}
                        </span>
                        <textarea
                          maxLength={1500}
                          className="field min-h-[80px]"
                          value={form.canvas[field.key] ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              canvas: { ...form.canvas, [field.key]: e.target.value },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Opublikuj fiszkę"}
                  </button>
                  {editingId && (
                    <button type="button" className="btn-ghost" disabled={busy} onClick={resetForm}>
                      Anuluj
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:sticky lg:top-24">
                <IdeaAssistant idea={form} onCanvas={fillCanvas} />
              </div>
            </div>
          )}
        </section>

        {user && myIdeas.length > 0 && (
          <section className="kb-section" aria-labelledby="moje-title">
            <h2 id="moje-title" className="font-display kb-section-title">
              Twoje fiszki
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {myIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea}>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" className="btn-ghost" onClick={() => startEdit(idea)}>
                      Edytuj<span className="sr-only">: {idea.name}</span>
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => void onDelete(idea)}>
                      Usuń<span className="sr-only">: {idea.name}</span>
                    </button>
                  </div>
                </IdeaCard>
              ))}
            </ul>
          </section>
        )}

        <section className="kb-section" id="pomysly" aria-labelledby="pomysly-title">
          <h2 id="pomysly-title" className="font-display kb-section-title">
            Pomysły i dobre praktyki
          </h2>
          <p className="kb-section-lead">
            Zgłoszone pomysły, prototypy i rozwiązania sprawdzone w mikroskali.
          </p>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtr etapu">
            <button
              type="button"
              className="kb-chip"
              aria-pressed={stageFilter === null}
              onClick={() => setStageFilter(null)}
            >
              Wszystkie
            </button>
            {STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className="kb-chip"
                aria-pressed={stageFilter === stage}
                onClick={() => setStageFilter(stage)}
              >
                {STAGE_LABEL[stage]}
              </button>
            ))}
          </div>
          {shownIdeas.length === 0 ? (
            <p className="mt-5 text-sm text-[var(--muted)]">
              {ideas.length === 0
                ? "Nie ma jeszcze żadnych fiszek — Twoja może być pierwsza."
                : "Brak pomysłów na tym etapie."}
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {shownIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </ul>
          )}
        </section>
      </main>
      <Toast message={toast} onClose={closeToast} />
    </>
  );
}
