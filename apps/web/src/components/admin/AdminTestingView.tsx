import { useEffect, useState } from "react";

import {
  deleteAdminSolutionReview,
  fetchAdminSolutionReviews,
  fetchAdminTesterSignups,
  setTesterSignupStatus,
  type AdminSolutionReview,
  type AdminTesterSignup,
  type IdeaStatus,
} from "@/lib/api";
import { KIND_LABEL, SIGNUP_STATUS } from "@/lib/testing";

type Tab = "signups" | "reviews";

const FILTERS: { value: IdeaStatus | null; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "pending", label: "Oczekujące" },
  { value: "approved", label: "Przyjęte" },
  { value: "rejected", label: "Nieprzyjęte" },
];

export function AdminTestingView() {
  const [tab, setTab] = useState<Tab>("signups");
  const [signups, setSignups] = useState<AdminTesterSignup[]>([]);
  const [reviews, setReviews] = useState<AdminSolutionReview[]>([]);
  const [filter, setFilter] = useState<IdeaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAdminTesterSignups(), fetchAdminSolutionReviews()])
      .then(([signupRows, reviewRows]) => {
        setSignups(signupRows);
        setReviews(reviewRows);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać danych"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onStatus(signup: AdminTesterSignup, status: IdeaStatus) {
    setBusyId(signup.id);
    setError(null);
    try {
      const saved = await setTesterSignupStatus(signup.id, status);
      setSignups((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić statusu");
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteReview(review: AdminSolutionReview) {
    if (!window.confirm(`Trwale usunąć opinię o „${review.target_name ?? "rozwiązaniu"}”?`)) return;
    setBusyId(review.id);
    setError(null);
    try {
      await deleteAdminSolutionReview(review.id);
      setReviews((prev) => prev.filter((row) => row.id !== review.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć opinii");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie…</p>;
  }

  const shownSignups = signups.filter((signup) => !filter || signup.status === filter);

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Widok">
        <button
          type="button"
          className="kb-chip"
          aria-pressed={tab === "signups"}
          onClick={() => setTab("signups")}
        >
          Zgłoszenia testerów ({signups.length})
        </button>
        <button
          type="button"
          className="kb-chip"
          aria-pressed={tab === "reviews"}
          onClick={() => setTab("reviews")}
        >
          Opinie ({reviews.length})
        </button>
      </div>

      {tab === "signups" ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr statusu">
            {FILTERS.map(({ value, label }) => (
              <button
                key={label}
                type="button"
                className="kb-chip"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} (
                {value ? signups.filter((row) => row.status === value).length : signups.length})
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {shownSignups.length === 0 && (
              <li className="text-sm text-[var(--muted)]">
                {signups.length === 0
                  ? "Nikt nie zgłosił się jeszcze do testów."
                  : "Brak zgłoszeń o tym statusie."}
              </li>
            )}
            {shownSignups.map((signup) => {
              const state = SIGNUP_STATUS[signup.status] ?? SIGNUP_STATUS.pending;
              const busy = busyId === signup.id;
              const name = signup.target_name ?? "Rozwiązanie usunięte";
              return (
                <li key={signup.id} className="surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="kb-meta">{KIND_LABEL[signup.target_kind]}</p>
                      <h2 className="mt-1 text-base font-semibold">{name}</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[
                          signup.tester_full_name,
                          signup.tester_email,
                          new Date(signup.created_at).toLocaleString("pl-PL"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className={state.className}>{state.label}</span>
                  </div>
                  {signup.motivation && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                      {signup.motivation}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {signup.status !== "approved" && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void onStatus(signup, "approved")}
                      >
                        Przyjmij<span className="sr-only">: {name}</span>
                      </button>
                    )}
                    {signup.status !== "rejected" && (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => void onStatus(signup, "rejected")}
                      >
                        Odrzuć<span className="sr-only">: {name}</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul className="space-y-3">
          {reviews.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Nie ma jeszcze żadnych opinii.</li>
          )}
          {reviews.map((review) => {
            const name = review.target_name ?? "Rozwiązanie usunięte";
            return (
              <li key={review.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="kb-meta">{KIND_LABEL[review.target_kind]}</p>
                    <h2 className="mt-1 text-base font-semibold">{name}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[
                        review.author_full_name,
                        review.author_email,
                        new Date(review.updated_at).toLocaleString("pl-PL"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="status-pill status-pill-new">Ocena {review.rating} / 5</span>
                </div>
                <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                  {review.feedback && (
                    <div>
                      <dt className="font-semibold">Informacja zwrotna</dt>
                      <dd className="whitespace-pre-line">{review.feedback}</dd>
                    </div>
                  )}
                  {review.improvement && (
                    <div>
                      <dt className="font-semibold">Propozycja usprawnień</dt>
                      <dd className="whitespace-pre-line">{review.improvement}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === review.id}
                    onClick={() => void onDeleteReview(review)}
                  >
                    Usuń opinię<span className="sr-only">: {name}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
