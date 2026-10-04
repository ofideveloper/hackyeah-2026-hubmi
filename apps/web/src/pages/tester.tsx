/**
 * Tester innowacji — zgłoszenia do testów, ocena rozwiązań, informacja zwrotna
 * i propozycje usprawnień. Lista i opinie są publiczne, zapis wymaga logowania.
 */
import Head from "next/head";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { SolutionDialog } from "@/components/tester/SolutionDialog";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchMyTesting,
  fetchTestSolutions,
  type MyTesting,
  type TestSolution,
  type TestTargetKind,
} from "@/lib/api";
import { formatDate } from "@/lib/ideas";
import {
  KIND_LABEL,
  ratingLabel,
  SIGNUP_STATUS,
  targetKey,
  testersLabel,
} from "@/lib/testing";

const PAGE_SIZE = 12;

const KIND_FILTERS: { value: TestTargetKind | null; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "innowacja", label: "Innowacje z biblioteki" },
  { value: "pomysl", label: "Pomysły z Kreatora" },
];

const NO_TESTING: MyTesting = { signups: [], reviews: [] };

export default function TesterPage() {
  const searchId = useId();
  const { user, sessionHint } = useAuth();
  const [solutions, setSolutions] = useState<TestSolution[] | null>(null);
  const [mine, setMine] = useState<MyTesting>(NO_TESTING);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TestTargetKind | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const reload = useCallback(() => {
    const fail = (err: unknown) =>
      setError(err instanceof Error ? err.message : "Nie udało się pobrać danych");
    fetchTestSolutions().then(setSolutions).catch(fail);
    if (sessionHint) {
      fetchMyTesting().then(setMine).catch(fail);
    } else {
      setMine(NO_TESTING);
    }
  }, [sessionHint]);

  useEffect(() => {
    reload();
  }, [reload]);

  // zmiana filtrów zaczyna listę od początku
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, kind]);

  const shown = useMemo(() => {
    const words = query.toLocaleLowerCase("pl").split(/\s+/).filter(Boolean);
    return (solutions ?? []).filter((item) => {
      const haystack = `${item.name} ${item.summary} ${item.category_name ?? ""}`.toLocaleLowerCase(
        "pl",
      );
      return (!kind || item.kind === kind) && words.every((word) => haystack.includes(word));
    });
  }, [solutions, query, kind]);

  const byKey = useMemo(
    () => new Map((solutions ?? []).map((item) => [targetKey(item), item])),
    [solutions],
  );
  const opened = openedKey ? byKey.get(openedKey) : undefined;
  const signupKeys = new Set(
    mine.signups.map((s) => targetKey({ kind: s.target_kind, id: s.target_id })),
  );
  const reviewKeys = new Set(
    mine.reviews.map((r) => targetKey({ kind: r.target_kind, id: r.target_id })),
  );

  return (
    <>
      <Head>
        <title>Tester innowacji · MaloHUB</title>
        <meta
          name="description"
          content="Zgłoś się do testów innowacji społecznych, oceń istniejące rozwiązania i zaproponuj usprawnienia."
        />
      </Head>

      <SiteHeader width="full" actions={<AppNav current="tester" />} />

      <main id="tresc" tabIndex={-1} className="kb-page mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14">
        <header className="animate-fade-up">
          <p className="kb-meta">Tester innowacji</p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Sprawdź rozwiązanie i <span className="text-[var(--accent-text)]">powiedz, co poprawić</span>
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Zgłoś się do testów, a po nich oceń rozwiązanie i podpowiedz autorom, co warto
            usprawnić. Opinie testerów są widoczne dla wszystkich.
          </p>
          <div className="mt-7 max-w-2xl">
            <label htmlFor={searchId} className="mb-1.5 block text-sm font-medium">
              Szukaj rozwiązania
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="np. seniorzy, opieka wytchnieniowa, praca"
              className="field"
            />
          </div>
        </header>

        {error && (
          <p className="mt-6 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        {user && (mine.signups.length > 0 || mine.reviews.length > 0) && (
          <section className="kb-section" aria-labelledby="moje-title">
            <h2 id="moje-title" className="font-display kb-section-title">
              Moje testy i opinie
            </h2>
            <p className="kb-section-lead">
              O przyjęciu do testów decyduje zespół — status zgłoszenia zobaczysz tutaj. Po przyjęciu
              możesz dodać opinię.
            </p>
            <div className="mt-5 grid items-start gap-4 md:grid-cols-2">
              <div className="surface p-5">
                <h3 className="font-display text-base font-semibold">Zgłoszenia do testów</h3>
                {mine.signups.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">Nie masz jeszcze zgłoszeń.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {mine.signups.map((signup) => {
                      const state = SIGNUP_STATUS[signup.status] ?? SIGNUP_STATUS.pending;
                      const key = targetKey({ kind: signup.target_kind, id: signup.target_id });
                      return (
                        <li key={signup.id} className="text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              className="kb-link text-left"
                              disabled={!byKey.has(key)}
                              onClick={() => setOpenedKey(key)}
                            >
                              {signup.target_name ?? "Rozwiązanie usunięte"}
                            </button>
                            <span className={state.className}>{state.label}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {formatDate(signup.created_at)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="surface p-5">
                <h3 className="font-display text-base font-semibold">Moje opinie</h3>
                {mine.reviews.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">Nie masz jeszcze opinii.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {mine.reviews.map((review) => {
                      const key = targetKey({ kind: review.target_kind, id: review.target_id });
                      return (
                        <li
                          key={review.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <button
                            type="button"
                            className="kb-link text-left"
                            disabled={!byKey.has(key)}
                            onClick={() => setOpenedKey(key)}
                          >
                            {review.target_name ?? "Rozwiązanie usunięte"}
                          </button>
                          <span className="font-semibold">
                            <span aria-hidden="true" className="rating-star">
                              ★{" "}
                            </span>
                            <span className="sr-only">Ocena </span>
                            {review.rating} / 5
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="kb-section" id="rozwiazania" aria-labelledby="rozwiazania-title">
          <h2 id="rozwiazania-title" className="font-display kb-section-title">
            Rozwiązania do oceny i testów
          </h2>
          <p className="kb-section-lead">
            Innowacje z Biblioteki Innowacji Społecznych oraz zatwierdzone pomysły z Kreatora.
            {!user && " Aby zgłosić się do testów, zaloguj się."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Rodzaj rozwiązania">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.label}
                type="button"
                className="kb-chip"
                aria-pressed={kind === filter.value}
                onClick={() => setKind(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <p className="sr-only" role="status">
            {solutions ? `Znaleziono rozwiązań: ${shown.length}.` : ""}
          </p>

          {!solutions && !error && (
            <p className="mt-5 text-sm text-[var(--muted)]" role="status">
              Ładowanie rozwiązań…
            </p>
          )}
          {solutions && shown.length === 0 && (
            <p className="kb-card mt-5 text-sm text-[var(--muted)]">
              Nic nie pasuje do tych filtrów.
            </p>
          )}
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.slice(0, visible).map((item) => {
              const key = targetKey(item);
              return (
                <li key={key} className="flex">
                  <button
                    type="button"
                    className="kb-card kb-card-button"
                    onClick={() => setOpenedKey(key)}
                  >
                    <span className="kb-meta">
                      {[KIND_LABEL[item.kind], item.category_name].filter(Boolean).join(" · ")}
                    </span>
                    <span className="font-display text-base font-semibold leading-snug">
                      {item.name}
                    </span>
                    <span className="kb-clamp text-sm leading-relaxed text-[var(--muted)]">
                      {item.summary}
                    </span>
                    <span className="mt-auto pt-1 text-sm font-semibold">
                      <span aria-hidden="true" className="rating-star">
                        ★{" "}
                      </span>
                      <span className="sr-only">Ocena: </span>
                      {ratingLabel(item)}
                      {item.testers_count > 0 && (
                        <span className="font-normal text-[var(--muted)]">
                          {" · "}
                          {testersLabel(item.testers_count)}
                        </span>
                      )}
                    </span>
                    {(signupKeys.has(key) || reviewKeys.has(key)) && (
                      <span className="flex flex-wrap gap-1.5">
                        {signupKeys.has(key) && <span className="kb-badge">Zgłoszono do testów</span>}
                        {reviewKeys.has(key) && <span className="kb-badge">Twoja opinia</span>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length > visible && (
            <div className="mt-6 text-center">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
              >
                Pokaż więcej ({shown.length - visible})
              </button>
            </div>
          )}
        </section>
      </main>

      {opened && (
        <SolutionDialog
          key={targetKey(opened)}
          solution={opened}
          loggedIn={Boolean(user)}
          myReview={
            mine.reviews.find(
              (r) => r.target_kind === opened.kind && r.target_id === opened.id,
            ) ?? null
          }
          mySignups={mine.signups.filter(
            (s) => s.target_kind === opened.kind && s.target_id === opened.id,
          )}
          onChanged={(message) => {
            setToast(message);
            reload();
          }}
          onClose={() => setOpenedKey(null)}
        />
      )}
      <Toast message={toast} onClose={closeToast} />
    </>
  );
}
