import { useEffect, useState } from "react";

import { fetchNeedTrends, type AreaTrend, type NeedTrends } from "@/lib/api";

const SPARK_HEIGHT = 28;
const SPARK_BAR = 8;
const SPARK_GAP = 3;

function formatWeek(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}`;
}

/** Zmiana 30 dni do poprzednich 30 — znak i słowo, nie sam kolor. */
function changeLabel(area: AreaTrend): string {
  const delta = area.last_30_days - area.previous_30_days;
  if (delta > 0) return `▲ +${delta} (rośnie)`;
  if (delta < 0) return `▼ ${delta} (spada)`;
  return "— bez zmian";
}

function WeeklyBars({ area, weeks }: { area: AreaTrend; weeks: string[] }) {
  const max = Math.max(1, ...area.weekly);
  const width = weeks.length * (SPARK_BAR + SPARK_GAP) - SPARK_GAP;
  const label = area.weekly
    .map((count, index) => `tydzień od ${formatWeek(weeks[index])}: ${count}`)
    .join(", ");
  return (
    <svg
      className="trend-spark"
      width={width}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${width} ${SPARK_HEIGHT}`}
      role="img"
      aria-label={`${area.name} — ${label}`}
    >
      {area.weekly.map((count, index) => {
        // zero rysujemy jako kreskę na osi, żeby pusty tydzień nie znikał
        const height = count === 0 ? 2 : Math.max(4, (count / max) * SPARK_HEIGHT);
        return (
          <rect
            key={weeks[index]}
            className={count === 0 ? "trend-spark-empty" : undefined}
            x={index * (SPARK_BAR + SPARK_GAP)}
            y={SPARK_HEIGHT - height}
            width={SPARK_BAR}
            height={height}
            rx={count === 0 ? 1 : 2}
          >
            <title>{`Tydzień od ${formatWeek(weeks[index])}: ${count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function AdminTrendsView() {
  const [trends, setTrends] = useState<NeedTrends | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNeedTrends()
      .then(setTrends)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać trendów"),
      );
  }, []);

  if (error) {
    return (
      <p className="text-sm text-[var(--danger)]" role="alert">
        {error}
      </p>
    );
  }
  if (!trends) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie trendów…</p>;
  }
  if (trends.total === 0) {
    return (
      <p className="surface p-5 text-sm leading-relaxed text-[var(--muted)]">
        Jeszcze nie ma danych. Potrzeby zapisują się, gdy opiekun w czacie dopasuje projekt
        albo stwierdzi, że w bazie brakuje odpowiedzi.
      </p>
    );
  }

  const maxLast = Math.max(1, ...trends.areas.map((area) => area.last_30_days));
  const unmetTotal = trends.areas.find((area) => area.category_id === null)?.total ?? 0;
  const top = trends.areas.find((area) => area.category_id !== null);

  return (
    <div className="space-y-8">
      <dl className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Zebrane potrzeby</dt>
          <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{trends.total}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Bez odpowiedzi w bazie
          </dt>
          <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{unmetTotal}</dd>
        </div>
        {top && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Najczęstszy obszar (30 dni)
            </dt>
            <dd className="font-display mt-1 text-2xl font-semibold">{top.name}</dd>
          </div>
        )}
      </dl>

      <section>
        <h2 className="text-base font-semibold">Potrzeby według obszarów</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Jedna rozmowa liczy się raz na obszar. Słupki tygodniowe mają własną skalę w każdym
          wierszu — pokazują kształt trendu, nie porównanie między obszarami.
        </p>
        <div className="surface mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Potrzeby wg obszarów</caption>
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Obszar</th>
                <th scope="col" className="px-4 py-3 font-medium">Ostatnie 30 dni</th>
                <th scope="col" className="px-4 py-3 font-medium">Poprzednie 30 dni</th>
                <th scope="col" className="px-4 py-3 font-medium">Zmiana</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Ostatnie {trends.weeks.length} tygodni
                </th>
                <th scope="col" className="px-4 py-3 font-medium">Łącznie</th>
              </tr>
            </thead>
            <tbody>
              {trends.areas.map((area) => (
                <tr
                  key={area.category_id ?? "unmet"}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <th scope="row" className="px-4 py-3 font-medium">{area.name}</th>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-right tabular-nums">{area.last_30_days}</span>
                      <div className="kb-bar w-32" aria-hidden>
                        <span style={{ width: `${(area.last_30_days / maxLast) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{area.previous_30_days}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{changeLabel(area)}</td>
                  <td className="px-4 py-3">
                    <WeeklyBars area={area} weeks={trends.weeks} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{area.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold">Potrzeby bez odpowiedzi w bazie</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Najnowsze tematy, dla których opiekun nie znalazł projektu — kandydaci na nowe
          innowacje i materiały.
        </p>
        <ul className="mt-4 space-y-3">
          {trends.unmet.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Brak takich potrzeb.</li>
          )}
          {trends.unmet.map((need) => (
            <li key={`${need.created_at}-${need.summary}`} className="surface p-4">
              <p className="text-sm leading-relaxed">{need.summary}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {new Date(need.created_at).toLocaleString("pl-PL")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
