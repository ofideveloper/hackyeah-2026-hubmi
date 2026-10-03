import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";

import { AssistantChat } from "@/components/AssistantChat";
import {
  createReport,
  fetchMe,
  fetchMyReports,
  fetchProjects,
  fetchUnits,
  type OrganizationalUnit,
  type Project,
  type Report,
  type ReportKind,
  type User,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const KIND_OPTIONS: { value: ReportKind; label: string }[] = [
  { value: "problem", label: "Problem" },
  { value: "wydarzenie", label: "Wydarzenie" },
  { value: "informacja", label: "Informacja" },
];

export default function AppHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const [unitId, setUnitId] = useState("");
  const [kind, setKind] = useState<ReportKind>("problem");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      void router.replace("/login");
      return;
    }

    fetchMe(token)
      .then(async (me) => {
        setUser(me);
        const [nextUnits, nextProjects, nextReports] = await Promise.all([
          fetchUnits(token).catch(() => [] as OrganizationalUnit[]),
          fetchProjects(token).catch(() => [] as Project[]),
          fetchMyReports(token).catch(() => [] as Report[]),
        ]);
        setUnits(nextUnits);
        setProjects(nextProjects);
        setReports(nextReports);
        if (nextUnits[0]) setUnitId(String(nextUnits[0].id));
      })
      .catch(() => {
        clearToken();
        void router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearToken();
    void router.push("/login");
  }

  const selectedUnit = units.find((u) => String(u.id) === unitId) ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !unitId) return;

    setFormError(null);
    setFormBusy(true);
    try {
      const report = await createReport(token, {
        unit_id: Number(unitId),
        kind,
        title,
        description,
      });
      setReports((prev) => [report, ...prev]);
      setTitle("");
      setDescription("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nie udało się utworzyć zgłoszenia");
    } finally {
      setFormBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <p className="text-[var(--muted)]">Ładowanie…</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>HubMI</title>
      </Head>
      <main className="animate-soft-in mx-auto min-h-screen max-w-3xl px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-8">
          <div>
            <p className="font-display text-sm font-semibold text-[var(--accent)]">HubMI</p>
            <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
              Cześć{user.full_name ? `, ${user.full_name}` : ""}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Zacznij od asystenta — potem możesz zgłosić sprawę do jednostki.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role === "admin" && (
              <Link href="/admin" className="btn-ghost">
                Admin
              </Link>
            )}
            <button type="button" onClick={logout} className="btn-ghost">
              Wyloguj
            </button>
          </div>
        </header>

        <section className="mt-8">
          <AssistantChat userName={user.full_name} />
        </section>

        <section className="mt-12">
          <h2 className="text-base font-semibold">Nowe zgłoszenie</h2>

          {units.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Brak jednostek organizacyjnych. Administrator musi najpierw dodać jednostki z
              zakresem odpowiedzialności.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="surface mt-4 space-y-4 p-5">
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Jednostka (odpowiedzialność)</span>
                <select
                  required
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="field"
                >
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedUnit && (
                <div className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--muted)]">
                  <p>
                    <span className="font-medium text-[var(--text)]">Teren:</span>{" "}
                    {selectedUnit.territory}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium text-[var(--text)]">Kompetencje:</span>{" "}
                    {selectedUnit.competencies}
                  </p>
                </div>
              )}

              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Rodzaj</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ReportKind)}
                  className="field"
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Tytuł</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field"
                  placeholder="Krótki opis sprawy"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Opis</span>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="field min-h-[100px]"
                  placeholder="Szczegóły zgłoszenia"
                />
              </label>

              {formError && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {formError}
                </p>
              )}

              <button type="submit" disabled={formBusy} className="btn-primary">
                {formBusy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
              </button>
            </form>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-base font-semibold">Projekty jednostek</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Lista projektów — asystent powyżej pomaga je dopasować do Twojej potrzeby.
          </p>
          <ul className="mt-4 space-y-3">
            {projects.length === 0 && (
              <li className="text-sm text-[var(--muted)]">Brak opublikowanych projektów.</li>
            )}
            {projects.map((project) => (
              <li key={project.id} className="surface p-4">
                <p className="font-medium">{project.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {project.unit_name ?? `Jednostka #${project.unit_id}`}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{project.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-base font-semibold">Twoje zgłoszenia</h2>
          <ul className="mt-4 space-y-3">
            {reports.length === 0 && (
              <li className="text-sm text-[var(--muted)]">Nie masz jeszcze żadnych zgłoszeń.</li>
            )}
            {reports.map((report) => (
              <li key={report.id} className="surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{report.title}</p>
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    {report.kind}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Do: {report.unit_name ?? `jednostka #${report.unit_id}`}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{report.description}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {new Date(report.created_at).toLocaleString("pl-PL")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
