/**
 * Middleman Innowacji — asystent AI przekłada innowację z Biblioteki na kartę usługi
 * dopasowaną do instytucji, która chce ją u siebie uruchomić. Narzędzie zespołu ROPS.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toast } from "@/components/Toast";
import {
  adaptInnovation,
  fetchKnowledge,
  type AdaptInput,
  type InnovationSummary,
  type InstitutionKind,
  type ServiceCard,
} from "@/lib/api";

const INSTITUTIONS: { value: InstitutionKind; label: string }[] = [
  { value: "jst", label: "Urząd gminy, miasta lub powiatu" },
  { value: "cus", label: "Centrum Usług Społecznych" },
  { value: "ops", label: "Ośrodek pomocy społecznej" },
  { value: "ngo", label: "Organizacja pozarządowa" },
  { value: "pes", label: "Podmiot ekonomii społecznej" },
  { value: "inna", label: "Inna instytucja" },
];

const EMPTY: AdaptInput = {
  innovation_id: "",
  institution_kind: "jst",
  institution_name: "",
  area: "",
  audience: "",
  resources: "",
  budget: "",
  constraints: "",
};

export default function MiddlemanPage() {
  const router = useRouter();
  const [innovations, setInnovations] = useState<InnovationSummary[]>([]);
  const [form, setForm] = useState<AdaptInput>(EMPTY);
  const [card, setCard] = useState<ServiceCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fetchKnowledge()
      .then((data) => setInnovations(data.innovations))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać listy innowacji"),
      );
  }, []);

  // Wstępny wybór innowacji: /admin/middleman?innovation=<id>
  const preselected = typeof router.query.innovation === "string" ? router.query.innovation : "";
  useEffect(() => {
    if (preselected) setForm((prev) => ({ ...prev, innovation_id: preselected }));
  }, [preselected]);

  // Po wygenerowaniu fokus trafia na nagłówek karty — czytnik ekranu ogłasza wynik.
  useEffect(() => {
    if (card) resultRef.current?.focus();
  }, [card]);

  function field<K extends keyof AdaptInput>(key: K) {
    return {
      value: form[key],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => setForm((prev) => ({ ...prev, [key]: event.target.value })),
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCard(await adaptInnovation(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się przygotować karty usługi");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.service_card);
      setToast("Skopiowano kartę usługi.");
    } catch {
      setToast("Nie udało się skopiować — zaznacz tekst ręcznie.");
    }
  }

  return (
    <AdminShell
      title="Middleman Innowacji"
      description="Wybierz innowację z Biblioteki i opisz instytucję, która się zgłosiła. Asystent przygotuje kartę usługi: co zostawić, co zmienić, jak zacząć i ile to może kosztować."
    >
      <div className="space-y-6">
        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[2fr_3fr]">
            <form onSubmit={onSubmit} className="surface space-y-4 p-5 print:hidden">
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Innowacja z Biblioteki</span>
                <select required className="field" {...field("innovation_id")}>
                  <option value="">Wybierz innowację…</option>
                  {innovations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Rodzaj instytucji</span>
                <select className="field" {...field("institution_kind")}>
                  {INSTITUTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Nazwa instytucji (opcjonalnie)
                </span>
                <input className="field" maxLength={300} {...field("institution_name")} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Teren działania (opcjonalnie) — np. gmina wiejska, 6 tys. mieszkańców
                </span>
                <input className="field" maxLength={300} {...field("area")} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Dla kogo ma być usługa i jaką potrzebę ma rozwiązać?
                </span>
                <textarea
                  required
                  minLength={3}
                  maxLength={1500}
                  className="field min-h-[88px]"
                  {...field("audience")}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Co instytucja już ma: ludzie, lokal, sprzęt (opcjonalnie)
                </span>
                <textarea maxLength={1500} className="field min-h-[72px]" {...field("resources")} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Budżet (opcjonalnie)</span>
                <input className="field" maxLength={300} {...field("budget")} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Ograniczenia, o których trzeba pamiętać (opcjonalnie)
                </span>
                <textarea
                  maxLength={1500}
                  className="field min-h-[72px]"
                  {...field("constraints")}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Przygotowuję kartę…" : card ? "Przygotuj ponownie" : "Przygotuj kartę usługi"}
              </button>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Nie wpisuj danych osobowych. Kartę przygotowuje AI na podstawie opisu innowacji z
                Biblioteki — traktuj ją jako punkt wyjścia do rozmowy, nie gotowy plan.
              </p>
            </form>

            <section className="surface p-5" aria-live="polite" aria-busy={busy}>
              {busy && (
                <p className="text-sm text-[var(--muted)]" role="status">
                  Asystent przygotowuje kartę usługi — to może potrwać kilkanaście sekund…
                </p>
              )}
              {!busy && !card && (
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Tu pojawi się karta usługi: zakres, kroki uruchomienia, potrzebne zasoby,
                  szacunkowy koszt, ryzyka i miary efektu.
                </p>
              )}
              {!busy && card && (
                <>
                  <p className="kb-meta">Karta usługi</p>
                  <h2
                    ref={resultRef}
                    tabIndex={-1}
                    className="font-display mt-1 text-xl font-semibold leading-snug"
                  >
                    {card.innovation_name}
                  </h2>
                  <div className="mt-4 text-[0.9375rem] leading-relaxed">
                    <ChatMarkdown content={card.service_card} />
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2 print:hidden">
                    <button type="button" className="btn-primary" onClick={() => void onCopy()}>
                      Kopiuj
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => window.print()}>
                      Drukuj
                    </button>
                  </div>
                </>
              )}
            </section>
        </div>
      </div>
      <Toast message={toast} onClose={closeToast} />
    </AdminShell>
  );
}
