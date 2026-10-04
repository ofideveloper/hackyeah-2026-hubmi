/**
 * Zasobnik wiedzy — wyzwania społeczne Małopolski, Biblioteka Innowacji
 * Społecznych i materiały edukacyjne. Publiczny, bez logowania.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { ExternalLinkIcon } from "@/components/ExternalLinkIcon";
import { InnovationDialog } from "@/components/knowledge/InnovationDialog";
import { VideoEmbed } from "@/components/knowledge/VideoEmbed";
import { AppNav, caretakerHref, SiteHeader } from "@/components/SiteHeader";
import {
  fetchKnowledge,
  type InnovationSummary,
  type KnowledgeOverview,
  type KnowledgeResource,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { youtubeId } from "@/lib/video";

const PAGE_SIZE = 12;
const PROBLEMS_PER_AREA = 3;

const SECTIONS = [
  { id: "wyzwania", label: "Wyzwania społeczne" },
  { id: "biblioteka", label: "Biblioteka innowacji" },
  { id: "materialy", label: "Materiały edukacyjne" },
] as const;

/** Małe litery bez polskich znaków — „Seniorów” i „seniorow” mają się spotkać. */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

// końcówki fleksyjne (już bez ogonków), od najdłuższych
const ENDINGS = ["osciami", "osciach", "oscia", "osci", "ami", "ach", "ow", "om", "em", "ia", "a", "e", "i", "o", "u", "y"];
const MIN_STEM = 4;

/** Prymitywny stemming: „praca” → „prac” łapie też „pracy”, „autyzmem” → „autyzm”. */
function stem(word: string): string {
  if (word.length <= MIN_STEM) return word;
  const ending = ENDINGS.find(
    (end) => word.endsWith(end) && word.length - end.length >= MIN_STEM,
  );
  return ending ? word.slice(0, -ending.length) : word;
}

function matches(query: string, ...texts: string[]): boolean {
  if (!query) return true;
  const haystack = normalize(texts.join(" "));
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(stem(word)));
}

/** Pierwsze zdanie — w kartach wyzwań pokazujemy sedno problemu, nie cały akapit. */
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

function ResourceCard({
  resource,
  areaName,
}: {
  resource: KnowledgeResource;
  areaName?: string;
}) {
  const isVideo = Boolean(youtubeId(resource.url));
  return (
    <li className="kb-card flex flex-col gap-2">
      <p className="kb-meta">
        {[resource.format, areaName].filter(Boolean).join(" · ") || "Zasób"}
      </p>
      <h3 className="font-display text-base font-semibold leading-snug">{resource.title}</h3>
      {resource.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
          {resource.summary}
        </p>
      )}
      {resource.url &&
        (isVideo ? (
          <div className="mt-2">
            <VideoEmbed url={resource.url} title={resource.title} />
          </div>
        ) : (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="kb-link mt-auto pt-1"
          >
            Otwórz: {resource.title}
            <ExternalLinkIcon />
            <span className="sr-only"> (otwiera się w nowej karcie)</span>
          </a>
        ))}
    </li>
  );
}

export default function KnowledgePage() {
  const searchId = useId();
  const [data, setData] = useState<KnowledgeOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [onlyVideo, setOnlyVideo] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [opened, setOpened] = useState<InnovationSummary | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(getToken()));
  }, []);

  useEffect(() => {
    fetchKnowledge()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać zasobów"),
      );
  }, []);

  // zmiana filtrów zaczyna listę od początku
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, areaId, onlyVideo]);

  const areaNames = useMemo(
    () => new Map((data?.areas ?? []).map((area) => [area.id, area.name])),
    [data],
  );

  const innovations = useMemo(
    () =>
      (data?.innovations ?? []).filter(
        (item) =>
          (!areaId || item.category_id === areaId) &&
          (!onlyVideo || item.has_video) &&
          matches(query, item.name, item.solution, item.problem),
      ),
    [data, areaId, onlyVideo, query],
  );

  const resources = useMemo(
    () =>
      (data?.resources ?? []).filter(
        (item) =>
          (!areaId || !item.category_id || item.category_id === areaId) &&
          matches(query, item.title, item.summary, item.format),
      ),
    [data, areaId, query],
  );
  const challenges = resources.filter((item) => item.kind === "wyzwanie");
  const materials = resources.filter((item) => item.kind === "material");

  const areas = (data?.areas ?? []).filter((area) => area.innovations > 0);
  const maxCount = Math.max(1, ...areas.map((area) => area.innovations));
  // przy wyszukiwaniu nie pokazujemy obszarów, w których nic nie pasuje
  const shownAreas = areas
    .filter((area) => !areaId || area.id === areaId)
    .map((area) => ({
      ...area,
      problems: innovations.filter((item) => item.category_id === area.id && item.problem),
    }))
    .filter((area) => !query.trim() || area.problems.length > 0);
  const videoCount = (data?.innovations ?? []).filter((item) => item.has_video).length;

  return (
    <>
      <Head>
        <title>Zasobnik wiedzy · MaloHUB</title>
        <meta
          name="description"
          content="Wyzwania społeczne Małopolski, sprawdzone innowacje społeczne i materiały edukacyjne ROPS Kraków w jednym miejscu."
        />
      </Head>

      <SiteHeader width="full" actions={<AppNav current="wiedza" />} />

      <main id="tresc" tabIndex={-1} className="kb-page mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14">
        <header className="animate-fade-up">
          <p className="kb-meta">Zasobnik wiedzy · ROPS Kraków</p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Co dzieje się w Małopolsce i{" "}
            <span className="text-[var(--accent)]">co już działa</span>
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Wybierz obszar albo wpisz, czego szukasz — pokażemy wyzwania, sprawdzone innowacje
            społeczne i materiały, które ich dotyczą.
          </p>

          <div className="mt-7 max-w-2xl">
            <label htmlFor={searchId} className="mb-1.5 block text-sm font-medium">
              Szukaj w zasobniku
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="np. samotność seniorów, autyzm, praca"
              className="field"
            />
          </div>

          {data && (
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { label: "Innowacji w bibliotece", value: data.innovations.length },
                { label: "Obszarów wsparcia", value: areas.length },
                { label: "Innowacji z filmem", value: videoCount },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="kb-meta">{stat.label}</dt>
                  <dd className="font-display mt-1 text-3xl font-semibold tabular-nums">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        {error && (
          <p className="mt-8 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {!data && !error && (
          <p className="mt-8 text-sm text-[var(--muted)]" role="status">
            Ładowanie zasobów…
          </p>
        )}

        {data && (
          <>
            <div className="kb-toolbar mt-10">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Obszar</legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="kb-chip"
                    aria-pressed={areaId === null}
                    onClick={() => setAreaId(null)}
                  >
                    Wszystkie
                  </button>
                  {areas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      className="kb-chip"
                      aria-pressed={areaId === area.id}
                      onClick={() => setAreaId(areaId === area.id ? null : area.id)}
                    >
                      {area.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <nav aria-label="Sekcje zasobnika" className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {SECTIONS.map((section) => (
                  <a key={section.id} href={`#${section.id}`} className="kb-link">
                    {section.label}
                  </a>
                ))}
              </nav>
              <p className="sr-only" role="status">
                Znaleziono: {innovations.length} innowacji, {challenges.length + materials.length}{" "}
                materiałów.
              </p>
            </div>

            <section id="wyzwania" aria-labelledby="wyzwania-h" className="kb-section">
              <h2 id="wyzwania-h" className="kb-section-title font-display">
                Wyzwania społeczne Małopolski
              </h2>
              <p className="kb-section-lead">
                Problemy, na które odpowiadają innowacje przetestowane w regionie — pogrupowane
                według tego, kogo dotyczą. Kliknij problem, żeby zobaczyć rozwiązanie.
              </p>

              {shownAreas.length === 0 && (
                <p className="kb-card mt-6 text-sm text-[var(--muted)]">
                  Brak wyzwań pasujących do tego wyszukiwania.
                </p>
              )}
              <ul className="mt-6 grid gap-4 md:grid-cols-2">
                {shownAreas.map((area) => {
                  const inArea = area.problems;
                  const limit = areaId ? inArea.length : PROBLEMS_PER_AREA;
                  return (
                    <li key={area.id} className={`kb-card ${areaId ? "md:col-span-2" : ""}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold leading-snug">
                          {area.name}
                        </h3>
                        <p className="shrink-0 text-sm text-[var(--muted)]">
                          <span className="font-display text-xl font-semibold tabular-nums text-[var(--text)]">
                            {area.innovations}
                          </span>{" "}
                          innowacji
                        </p>
                      </div>
                      {/* udział obszaru w bibliotece — liczba obok niesie tę samą informację */}
                      <div className="kb-bar mt-3" aria-hidden>
                        <span style={{ width: `${(area.innovations / maxCount) * 100}%` }} />
                      </div>

                      {inArea.length === 0 ? (
                        <p className="mt-4 text-sm text-[var(--muted)]">
                          Brak wyników dla tego wyszukiwania.
                        </p>
                      ) : (
                        <ul className="mt-4 space-y-2">
                          {inArea.slice(0, limit).map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                className="kb-problem"
                                onClick={() => setOpened(item)}
                              >
                                <span>{firstSentence(item.problem)}</span>
                                <span className="kb-problem-answer">
                                  Rozwiązanie: {item.name}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!areaId && inArea.length > limit && (
                        <button
                          type="button"
                          className="kb-link mt-3"
                          onClick={() => setAreaId(area.id)}
                        >
                          Pokaż wszystkie ({inArea.length})
                          <span className="sr-only"> w obszarze {area.name}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {challenges.length > 0 && (
                <>
                  <h3 className="font-display mt-10 text-lg font-semibold">
                    Raporty, diagnozy i dane
                  </h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {challenges.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        areaName={areaNames.get(resource.category_id ?? "")}
                      />
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section id="biblioteka" aria-labelledby="biblioteka-h" className="kb-section">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="biblioteka-h" className="kb-section-title font-display">
                    Biblioteka Innowacji Społecznych
                  </h2>
                  <p className="kb-section-lead">
                    Sprawdzone rozwiązania gotowe do wdrożenia — {innovations.length}{" "}
                    {areaId || query || onlyVideo ? "pasujących do filtrów" : "w bibliotece"}.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={onlyVideo}
                    onChange={(event) => setOnlyVideo(event.target.checked)}
                  />
                  Tylko z filmem
                </label>
              </div>

              {innovations.length === 0 ? (
                <p className="kb-card mt-6 text-sm text-[var(--muted)]">
                  Nic nie pasuje do tych filtrów. Zmień wyszukiwanie albo{" "}
                  <Link href={caretakerHref(loggedIn)} className="kb-link">
                    opisz potrzebę opiekunowi
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {innovations.slice(0, visible).map((item) => (
                    <li key={item.id} className="flex">
                      <button
                        type="button"
                        className="kb-card kb-card-button"
                        onClick={() => setOpened(item)}
                      >
                        <span className="kb-meta flex items-center justify-between gap-2">
                          <span>{areaNames.get(item.category_id)}</span>
                          {item.has_video && <span className="kb-badge">▶ Film</span>}
                        </span>
                        <span className="font-display text-base font-semibold leading-snug">
                          {item.name}
                        </span>
                        <span className="kb-clamp text-sm leading-relaxed text-[var(--muted)]">
                          {item.solution || item.problem}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {innovations.length > visible && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setVisible((count) => count + PAGE_SIZE)}
                  >
                    Pokaż więcej ({innovations.length - visible})
                  </button>
                </div>
              )}
            </section>

            <section id="materialy" aria-labelledby="materialy-h" className="kb-section">
              <h2 id="materialy-h" className="kb-section-title font-display">
                Materiały edukacyjne
              </h2>
              <p className="kb-section-lead">
                Publikacje, poradniki i filmy o innowacjach społecznych i problemach, które
                rozwiązują.
              </p>
              {materials.length === 0 ? (
                <p className="kb-card mt-6 text-sm text-[var(--muted)]">
                  Brak materiałów dla tych filtrów.
                </p>
              ) : (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {materials.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      areaName={areaNames.get(resource.category_id ?? "")}
                    />
                  ))}
                </ul>
              )}
            </section>

            <aside className="mt-16 flex flex-col justify-between gap-5 rounded-2xl bg-[var(--text)] px-6 py-7 text-white sm:flex-row sm:items-center sm:px-8">
              <div>
                <h2 className="font-display text-xl font-semibold">Nie ma tu Twojej sprawy?</h2>
                <p className="mt-1.5 text-sm text-white/75">
                  Opisz ją opiekunowi — dobierze rozwiązanie albo przekaże potrzebę zespołowi.
                </p>
              </div>
              <Link
                href={caretakerHref(loggedIn)}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--accent-light)]"
              >
                Porozmawiaj z opiekunem
              </Link>
            </aside>
          </>
        )}
      </main>

      {opened && (
        <InnovationDialog
          innovationId={opened.id}
          name={opened.name}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}
