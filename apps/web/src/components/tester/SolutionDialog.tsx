import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  createTesterSignup,
  deleteSolutionReview,
  fetchSolutionReviews,
  saveSolutionReview,
  withdrawTesterSignup,
  type SolutionReview,
  type TesterSignup,
  type TestSolution,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatDate } from "@/lib/ideas";
import { KIND_LABEL, RATINGS, ratingLabel, SIGNUP_STATUS } from "@/lib/testing";

type SolutionDialogProps = {
  solution: TestSolution;
  loggedIn: boolean;
  myReview: SolutionReview | null;
  /** Zgłoszenia zalogowanego do testów tego rozwiązania */
  mySignups: TesterSignup[];
  /** Po każdym zapisie — rodzic odświeża listę i pokazuje potwierdzenie */
  onChanged: (message: string) => void;
  onClose: () => void;
};

/** Opinie o rozwiązaniu, formularz opinii i zgłoszenie do testów — natywny `<dialog>`. */
export function SolutionDialog({
  solution,
  loggedIn,
  myReview,
  mySignups,
  onChanged,
  onClose,
}: SolutionDialogProps) {
  const titleId = useId();
  const ratingName = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reviews, setReviews] = useState<SolutionReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState<number | null>(myReview?.rating ?? null);
  const [feedback, setFeedback] = useState(myReview?.feedback ?? "");
  const [improvement, setImprovement] = useState(myReview?.improvement ?? "");
  const [motivation, setMotivation] = useState("");
  // opinię przyjmuje API tylko od testera — osoby z przyjętym zgłoszeniem
  const isTester = mySignups.some((signup) => signup.status === "approved");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const loadReviews = useCallback(() => {
    fetchSolutionReviews(solution)
      .then(setReviews)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać opinii"),
      );
  }, [solution]);

  useEffect(loadReviews, [loadReviews]);

  /** Wspólna obsługa zapisu: blokada przycisków, błąd w oknie, potwierdzenie u rodzica. */
  async function run(action: (token: string) => Promise<unknown>, message: string) {
    const token = getToken();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await action(token);
      onChanged(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  async function onReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating == null) return;
    await run(
      (token) => saveSolutionReview(token, solution, { rating, feedback, improvement }),
      myReview ? "Zaktualizowano Twoją opinię." : "Dziękujemy za opinię.",
    );
    loadReviews();
  }

  async function onDeleteReview() {
    if (!window.confirm("Usunąć Twoją opinię o tym rozwiązaniu?")) return;
    await run((token) => deleteSolutionReview(token, solution), "Usunięto opinię.");
    setRating(null);
    setFeedback("");
    setImprovement("");
    loadReviews();
  }

  async function onSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      (token) => createTesterSignup(token, solution, motivation),
      `Zgłoszono chęć testowania: „${solution.name}”.`,
    );
    setMotivation("");
  }

  return (
    // Klik w tło natywnego <dialog> to dodatek dla myszy; klawiaturą zamyka Escape (onCancel)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="kb-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="kb-dialog-body">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="project-modal-kicker">
              {[KIND_LABEL[solution.kind], solution.category_name].filter(Boolean).join(" · ")}
            </p>
            <h2 id={titleId} className="font-display project-modal-title">
              {solution.name}
            </h2>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Zamknij
          </button>
        </div>

        <p className="mt-2 text-sm font-semibold">
          <span aria-hidden="true" className="rating-star">
            ★{" "}
          </span>
          <span className="sr-only">Ocena: </span>
          {ratingLabel(solution)}
        </p>
        {solution.summary && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
            {solution.summary}
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        {!loggedIn ? (
          <p className="surface mt-5 p-4 text-sm leading-relaxed">
            <Link href="/login" className="kb-link">
              Zaloguj się
            </Link>
            , aby zgłosić się do testów. Po testach ocenisz rozwiązanie i zaproponujesz
            usprawnienia.
          </p>
        ) : (
          <>
            {!isTester && (
              <div className="kb-dialog-section mt-5">
                <h3 className="kb-dialog-heading">Oceń rozwiązanie</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Opinię mogą dodać tylko testerzy tego rozwiązania. Zgłoś się do testów poniżej —
                  formularz oceny pojawi się, gdy zespół przyjmie Twoje zgłoszenie.
                </p>
                {myReview && (
                  <button
                    type="button"
                    className="kb-link mt-2"
                    disabled={busy}
                    onClick={() => void onDeleteReview()}
                  >
                    Usuń moją opinię
                  </button>
                )}
              </div>
            )}
            {isTester && (
              <form onSubmit={onReview} className="kb-dialog-section mt-5 space-y-4">
                <h3 className="kb-dialog-heading">
                  {myReview ? "Twoja opinia" : "Oceń rozwiązanie"}
                </h3>
                <fieldset>
                  <legend className="mb-1.5 text-sm text-[var(--muted)]">
                    Ocena (1 — słabo, 5 — bardzo dobrze)
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {RATINGS.map((value) => (
                      <label key={value} className="rating-option">
                        <input
                          type="radio"
                          className="sr-only"
                          name={ratingName}
                          value={value}
                          required
                          checked={rating === value}
                          onChange={() => setRating(value)}
                        />
                        <span aria-hidden="true">★</span> {value}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    Informacja zwrotna — co działa, a co nie?
                  </span>
                  <textarea
                    maxLength={2000}
                    className="field min-h-[80px]"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    Propozycja usprawnień — co warto zmienić?
                  </span>
                  <textarea
                    maxLength={2000}
                    className="field min-h-[80px]"
                    value={improvement}
                    onChange={(e) => setImprovement(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn-primary" disabled={busy}>
                    {myReview ? "Zapisz zmiany" : "Wyślij opinię"}
                  </button>
                  {myReview && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() => void onDeleteReview()}
                    >
                      Usuń opinię
                    </button>
                  )}
                </div>
              </form>
            )}

            <form onSubmit={onSignup} className="kb-dialog-section space-y-3">
              <h3 className="kb-dialog-heading">Udział w testach</h3>
              {mySignups.length > 0 && (
                <ul className="space-y-2">
                  {mySignups.map((signup) => {
                    const state = SIGNUP_STATUS[signup.status] ?? SIGNUP_STATUS.pending;
                    return (
                      <li
                        key={signup.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          Zgłoszenie z {formatDate(signup.created_at)}{" "}
                          <span className={state.className}>{state.label}</span>
                        </span>
                        <button
                          type="button"
                          className="kb-link"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              (token) => withdrawTesterSignup(token, signup.id),
                              "Wycofano zgłoszenie do testów.",
                            )
                          }
                        >
                          Wycofaj
                          <span className="sr-only">
                            {" "}
                            zgłoszenie z {formatDate(signup.created_at)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Dlaczego chcesz testować? Gdzie i z kim? (opcjonalnie)
                </span>
                <textarea
                  maxLength={1000}
                  className="field min-h-[64px]"
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {mySignups.length > 0 ? "Zgłoś się ponownie" : "Chcę testować"}
              </button>
            </form>
          </>
        )}

        <section className="kb-dialog-section mt-5">
          <h3 className="kb-dialog-heading">Opinie</h3>
          {!reviews && !error && (
            <p className="text-sm text-[var(--muted)]" role="status">
              Ładowanie opinii…
            </p>
          )}
          {reviews?.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Nikt jeszcze nie ocenił tego rozwiązania.</p>
          )}
          {reviews && reviews.length > 0 && (
            <ul className="space-y-4">
              {reviews.map((review) => (
                <li key={review.id} className="text-sm leading-relaxed">
                  <p className="font-semibold">
                    <span aria-hidden="true" className="rating-star">
                      ★{" "}
                    </span>
                    <span className="sr-only">Ocena </span>
                    {review.rating} / 5
                    <span className="font-normal text-[var(--muted)]">
                      {" · "}
                      {[review.author_name, formatDate(review.updated_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                  {review.feedback && <p className="whitespace-pre-line">{review.feedback}</p>}
                  {review.improvement && (
                    <p className="whitespace-pre-line">
                      <span className="font-semibold">Usprawnienie: </span>
                      {review.improvement}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
