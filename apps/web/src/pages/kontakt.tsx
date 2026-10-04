/**
 * Platforma komunikacji — pytania do ROPS, rozmowy z mentorami i ogłoszenia partnerskie.
 * Mentorzy i ogłoszenia są publiczne; rozmowy wymagają logowania.
 */
import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";

import { ComposeDialog } from "@/components/communication/ComposeDialog";
import { ThreadList } from "@/components/communication/ThreadList";
import { ThreadView } from "@/components/communication/ThreadView";
import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { SiteTitle, SiteTitleAccent } from "@/components/SiteTitle";
import { Toast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useThreads } from "@/hooks/useThreads";
import {
  contactListingAuthor,
  createConversation,
  createListing,
  deleteListing,
  fetchListings,
  fetchMentors,
  updateMyProfile,
  type Listing,
  type ListingKind,
  type Mentor,
  type Sector,
  type User,
} from "@/lib/api";
import {
  LISTING_KIND_LABEL,
  MENTOR_BIO_MAX,
  MESSAGE_BODY_MAX,
  ORGANIZATION_MAX,
  SECTOR_LABEL,
  SECTORS,
  THREAD_SUBJECT_MAX,
  unreadCount,
} from "@/lib/communication";
import { formatDate } from "@/lib/ideas";

type Tab = "rozmowy" | "mentorzy" | "partnerstwa";

type Compose =
  | { type: "pytanie" }
  | { type: "mentor"; mentor: Mentor }
  | { type: "ogloszenie"; listing: Listing };

const KIND_FILTERS: { value: ListingKind | null; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "szukam", label: "Szukam" },
  { value: "oferuje", label: "Oferuję" },
];

function SectorSelect({
  value,
  onChange,
  emptyLabel,
}: {
  value: Sector | null;
  onChange: (value: Sector | null) => void;
  emptyLabel: string;
}) {
  return (
    <select
      className="field"
      value={value ?? ""}
      onChange={(event) => onChange((event.target.value || null) as Sector | null)}
    >
      <option value="">{emptyLabel}</option>
      {SECTORS.map((sector) => (
        <option key={sector} value={sector}>
          {SECTOR_LABEL[sector]}
        </option>
      ))}
    </select>
  );
}

function ProfileForm({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const { canUseSession } = useAuth();
  const [sector, setSector] = useState<Sector | null>(user.sector ?? null);
  const [organization, setOrganization] = useState(user.organization ?? "");
  const [bio, setBio] = useState(user.mentor_bio ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseSession) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateMyProfile({ sector, organization, mentor_bio: bio }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać profilu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface mt-5 max-w-2xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Sektor</span>
          <SectorSelect value={sector} onChange={setSector} emptyLabel="— nie wybrano —" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Organizacja (opcjonalnie)</span>
          <input
            type="text"
            autoComplete="organization"
            maxLength={ORGANIZATION_MAX}
            className="field"
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </label>
      </div>
      {user.role === "specialist" && (
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">
            W czym pomagasz jako mentor? Opis zobaczą wszyscy odwiedzający.
          </span>
          <textarea
            maxLength={MENTOR_BIO_MAX}
            className="field min-h-[96px]"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        Zapisz profil
      </button>
    </form>
  );
}

function ListingForm({ onCreated }: { onCreated: () => void }) {
  const { canUseSession } = useAuth();
  const [kind, setKind] = useState<ListingKind>("szukam");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [soughtSector, setSoughtSector] = useState<Sector | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseSession) return;
    setBusy(true);
    setError(null);
    try {
      await createListing({ kind, title, description, sought_sector: soughtSector });
      setTitle("");
      setDescription("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać ogłoszenia");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface mt-5 space-y-4 p-5">
      <h3 className="font-display text-base font-semibold">Dodaj ogłoszenie</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Rodzaj</span>
          <select
            className="field"
            value={kind}
            onChange={(event) => setKind(event.target.value as ListingKind)}
          >
            <option value="szukam">Szukam partnera</option>
            <option value="oferuje">Oferuję współpracę</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Partner z sektora (opcjonalnie)</span>
          <SectorSelect value={soughtSector} onChange={setSoughtSector} emptyLabel="Dowolny" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block text-[var(--muted)]">Tytuł</span>
        <input
          type="text"
          required
          minLength={2}
          maxLength={THREAD_SUBJECT_MAX}
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-[var(--muted)]">
          Opis — czego szukasz albo co możesz wnieść?
        </span>
        <textarea
          required
          minLength={2}
          maxLength={MESSAGE_BODY_MAX}
          className="field min-h-[96px]"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        Opublikuj ogłoszenie
      </button>
    </form>
  );
}

export default function ContactPage() {
  const tabsId = useId();
  const { user, setUser, canUseSession } = useAuth();
  const [tab, setTab] = useState<Tab>("rozmowy");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [kind, setKind] = useState<ListingKind | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const { threads, error: threadsError, reload: reloadThreads } = useThreads(Boolean(user));

  const reloadBoard = useCallback(() => {
    const fail = (err: unknown) =>
      setError(err instanceof Error ? err.message : "Nie udało się pobrać danych");
    fetchMentors().then(setMentors).catch(fail);
    fetchListings().then(setListings).catch(fail);
  }, []);

  // `is_mine` w ogłoszeniach zależy od sesji — odśwież po zalogowaniu / wylogowaniu
  useEffect(() => {
    reloadBoard();
  }, [reloadBoard, canUseSession]);

  const shownListings = useMemo(
    () =>
      (listings ?? []).filter(
        (item) =>
          (!kind || item.kind === kind) &&
          // sektor pasuje, gdy ogłasza się z niego autor albo to jego autor szuka
          (!sector || item.author_sector === sector || item.sought_sector === sector),
      ),
    [listings, kind, sector],
  );

  const unread = unreadCount(threads ?? []);

  async function onCompose(target: Compose, values: { subject: string; body: string }) {
    if (!canUseSession) return;
    const created =
      target.type === "ogloszenie"
        ? await contactListingAuthor(target.listing.id, values.body)
        : await createConversation({
            kind: target.type === "mentor" ? "mentoring" : "pytanie",
            subject: values.subject,
            body: values.body,
            mentor_id: target.type === "mentor" ? target.mentor.id : undefined,
          });
    setCompose(null);
    setSelectedId(created.id);
    setTab("rozmowy");
    reloadThreads();
    setToast("Wiadomość wysłana. Odpowiedź pojawi się w zakładce Rozmowy.");
  }

  async function onDeleteListing(listing: Listing) {
    if (!canUseSession) return;
    if (!window.confirm(`Usunąć ogłoszenie „${listing.title}”?`)) return;
    setError(null);
    try {
      await deleteListing(listing.id);
      setToast("Usunięto ogłoszenie.");
      reloadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć ogłoszenia");
    }
  }

  const loginHint = (action: string) => (
    <p className="surface mt-5 max-w-2xl p-4 text-sm leading-relaxed">
      <Link href="/login" className="kb-link">
        Zaloguj się
      </Link>
      , aby {action}.
    </p>
  );

  return (
    <>
      <Head>
        <title>Kontakt i współpraca · MaloHUB</title>
        <meta
          name="description"
          content="Zadaj pytanie zespołowi ROPS, napisz do mentora i znajdź partnera z innego sektora."
        />
      </Head>

      <SiteHeader width="full" actions={<AppNav current="kontakt" />} />

      <main id="tresc" tabIndex={-1} className="kb-page mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14">
        <header>
          <p className="kb-meta">Kontakt i współpraca</p>
          <SiteTitle>
            Zapytaj, poradź się i <SiteTitleAccent>znajdź partnera</SiteTitleAccent>
          </SiteTitle>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Napisz bezpośrednio do zespołu ROPS, skorzystaj ze wsparcia mentora albo nawiąż
            współpracę z organizacją z innego sektora.
          </p>
          <div className="mt-7 flex flex-wrap gap-2" role="group" aria-labelledby={tabsId}>
            <span id={tabsId} className="sr-only">
              Sekcja
            </span>
            <button
              type="button"
              className="kb-chip"
              aria-pressed={tab === "rozmowy"}
              onClick={() => setTab("rozmowy")}
            >
              Rozmowy{unread > 0 && ` (nowe: ${unread})`}
            </button>
            <button
              type="button"
              className="kb-chip"
              aria-pressed={tab === "mentorzy"}
              onClick={() => setTab("mentorzy")}
            >
              Mentorzy
            </button>
            <button
              type="button"
              className="kb-chip"
              aria-pressed={tab === "partnerstwa"}
              onClick={() => setTab("partnerstwa")}
            >
              Partnerstwa
            </button>
          </div>
        </header>

        {(error || threadsError) && (
          <p className="mt-6 text-sm text-[var(--danger)]" role="alert">
            {error ?? threadsError}
          </p>
        )}

        {tab === "rozmowy" && (
          <section className="kb-section" aria-labelledby="rozmowy-title">
            <h2 id="rozmowy-title" className="font-display kb-section-title">
              Twoje rozmowy
            </h2>
            <p className="kb-section-lead">
              Pytania do zespołu ROPS, rozmowy z mentorami i odpowiedzi na ogłoszenia partnerskie.
              Nowe wiadomości pojawiają się same, bez odświeżania strony.
            </p>
            {!user ? (
              loginHint("zadać pytanie zespołowi ROPS i zobaczyć swoje rozmowy")
            ) : (
              <>
                <div className="mt-5">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setCompose({ type: "pytanie" })}
                  >
                    Zadaj pytanie ROPS
                  </button>
                </div>
                {!threads && !threadsError && (
                  <p className="mt-5 text-sm text-[var(--muted)]" role="status">
                    Ładowanie rozmów…
                  </p>
                )}
                {threads && (
                  <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <ThreadList
                      threads={threads}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      emptyText="Nie masz jeszcze rozmów. Zadaj pytanie ROPS albo napisz do mentora."
                    />
                    {selectedId ? (
                      <ThreadView
                        key={selectedId}
                        conversationId={selectedId}
                        onChanged={reloadThreads}
                      />
                    ) : (
                      threads.length > 0 && (
                        <p className="kb-card text-sm text-[var(--muted)]">
                          Wybierz rozmowę z listy.
                        </p>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {tab === "mentorzy" && (
          <section className="kb-section" aria-labelledby="mentorzy-title">
            <h2 id="mentorzy-title" className="font-display kb-section-title">
              Mentorzy
            </h2>
            <p className="kb-section-lead">
              Praktycy, którzy pomogą dopracować pomysł, przygotować test albo wniosek. Rozmowa z
              mentorem jest prywatna.
            </p>
            {!user && loginHint("napisać do mentora")}
            {!mentors && !error && (
              <p className="mt-5 text-sm text-[var(--muted)]" role="status">
                Ładowanie mentorów…
              </p>
            )}
            {mentors?.length === 0 && (
              <p className="kb-card mt-5 text-sm text-[var(--muted)]">
                Nie ma jeszcze mentorów. Z pytaniem możesz zwrócić się do zespołu ROPS.
              </p>
            )}
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {(mentors ?? []).map((mentor) => {
                const name = mentor.name ?? "Mentor";
                return (
                  <li key={mentor.id} className="kb-card flex flex-col gap-2">
                    <p className="kb-meta">
                      {[mentor.sector && SECTOR_LABEL[mentor.sector], mentor.organization]
                        .filter(Boolean)
                        .join(" · ") || "Mentor"}
                    </p>
                    <h3 className="font-display text-base font-semibold leading-snug">{name}</h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
                      {mentor.bio ?? "Mentor nie dodał jeszcze opisu."}
                    </p>
                    {user && user.id !== mentor.id && (
                      <div className="mt-auto pt-2">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setCompose({ type: "mentor", mentor })}
                        >
                          Napisz do mentora<span className="sr-only">: {name}</span>
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "partnerstwa" && (
          <section className="kb-section" aria-labelledby="partnerstwa-title">
            <h2 id="partnerstwa-title" className="font-display kb-section-title">
              Ogłoszenia partnerskie
            </h2>
            <p className="kb-section-lead">
              Organizacje pozarządowe, samorządy, firmy i uczelnie szukają tu partnerów do wspólnych
              działań. Odpowiedź na ogłoszenie otwiera prywatną rozmowę z jego autorem.
            </p>
            {!user && loginHint("dodać ogłoszenie albo odpowiedzieć na cudze")}
            {user &&
              (user.sector ? (
                <ListingForm
                  onCreated={() => {
                    setToast("Ogłoszenie opublikowane.");
                    reloadBoard();
                  }}
                />
              ) : (
                <p className="surface mt-5 max-w-2xl p-4 text-sm leading-relaxed">
                  Aby dodać ogłoszenie,{" "}
                  <a href="#profil" className="kb-link">
                    wybierz swój sektor w profilu
                  </a>
                  .
                </p>
              ))}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:items-end">
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Rodzaj ogłoszenia"
              >
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
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Sektor</span>
                <SectorSelect value={sector} onChange={setSector} emptyLabel="Wszystkie sektory" />
              </label>
            </div>
            <p className="sr-only" role="status">
              {listings ? `Znaleziono ogłoszeń: ${shownListings.length}.` : ""}
            </p>

            {!listings && !error && (
              <p className="mt-5 text-sm text-[var(--muted)]" role="status">
                Ładowanie ogłoszeń…
              </p>
            )}
            {listings && shownListings.length === 0 && (
              <p className="kb-card mt-5 text-sm text-[var(--muted)]">
                {listings.length === 0
                  ? "Nie ma jeszcze ogłoszeń."
                  : "Nic nie pasuje do tych filtrów."}
              </p>
            )}
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {shownListings.map((listing) => (
                <li key={listing.id} className="kb-card flex flex-col gap-2">
                  <p className="kb-meta">
                    {LISTING_KIND_LABEL[listing.kind]}
                    {listing.sought_sector &&
                      ` · partner: ${SECTOR_LABEL[listing.sought_sector]}`}
                  </p>
                  <h3 className="font-display text-base font-semibold leading-snug">
                    {listing.title}
                  </h3>
                  <p className="whitespace-pre-line break-words text-sm leading-relaxed">
                    {listing.description}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {[
                      listing.author_name,
                      listing.author_organization,
                      listing.author_sector && SECTOR_LABEL[listing.author_sector],
                      formatDate(listing.created_at),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    {listing.is_mine && <span className="kb-badge">Twoje ogłoszenie</span>}
                    {user && !listing.is_mine && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setCompose({ type: "ogloszenie", listing })}
                      >
                        Odpowiedz<span className="sr-only">: {listing.title}</span>
                      </button>
                    )}
                    {user && (listing.is_mine || user.role === "admin") && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => void onDeleteListing(listing)}
                      >
                        Usuń<span className="sr-only">: {listing.title}</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {user && (
          <section className="kb-section" id="profil" aria-labelledby="profil-title">
            <h2 id="profil-title" className="font-display kb-section-title">
              Twój profil
            </h2>
            <p className="kb-section-lead">
              Sektor i organizacja są widoczne przy Twoich ogłoszeniach. Bez wybranego sektora nie
              dodasz ogłoszenia.
            </p>
            <ProfileForm
              user={user}
              onSaved={(saved) => {
                setUser(saved);
                setToast("Zapisano profil.");
                reloadBoard();
              }}
            />
          </section>
        )}
      </main>

      {compose && (
        <ComposeDialog
          kicker={
            compose.type === "pytanie"
              ? "Pytanie do ROPS"
              : compose.type === "mentor"
                ? "Rozmowa z mentorem"
                : "Odpowiedź na ogłoszenie"
          }
          title={
            compose.type === "pytanie"
              ? "Zadaj pytanie zespołowi ROPS"
              : compose.type === "mentor"
                ? (compose.mentor.name ?? "Mentor")
                : compose.listing.title
          }
          withSubject={compose.type !== "ogloszenie"}
          bodyLabel={compose.type === "pytanie" ? "Twoje pytanie" : "Twoja wiadomość"}
          submitLabel="Wyślij"
          onSubmit={(values) => onCompose(compose, values)}
          onClose={() => setCompose(null)}
        />
      )}
      <Toast message={toast} onClose={closeToast} />
    </>
  );
}
