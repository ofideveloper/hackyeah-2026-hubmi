import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";

import {
  createProject,
  createUnit,
  deleteProject,
  deleteUnit,
  fetchAdminReports,
  fetchAdminStats,
  fetchAdminUsers,
  fetchMe,
  fetchProjects,
  fetchUnits,
  updateProject,
  updateReportStatus,
  type AdminStats,
  type OrganizationalUnit,
  type Project,
  type Report,
  type ReportStatus,
  type User,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
  { value: "nowe", label: "Przyjęte" },
  { value: "w_toku", label: "W trakcie" },
  { value: "zakonczone", label: "Zakończone" },
];

export function AdminPanel() {
  const router = useRouter();
  const [admin, setAdmin] = useState<User | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [territory, setTerritory] = useState("");
  const [competencies, setCompetencies] = useState("");
  const [unitError, setUnitError] = useState<string | null>(null);
  const [unitBusy, setUnitBusy] = useState(false);

  const [projectUnitId, setProjectUnitId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      void router.replace("/login");
      return;
    }

    Promise.all([
      fetchMe(token),
      fetchAdminStats(token),
      fetchAdminUsers(token),
      fetchUnits(token),
      fetchProjects(token),
      fetchAdminReports(token),
    ])
      .then(([me, nextStats, nextUsers, nextUnits, nextProjects, nextReports]) => {
        if (me.role !== "admin") {
          throw new Error("Brak uprawnień administratora");
        }
        setAdmin(me);
        setStats(nextStats);
        setUsers(nextUsers);
        setUnits(nextUnits);
        setProjects(nextProjects);
        setReports(nextReports);
        if (nextUnits[0]) setProjectUnitId(String(nextUnits[0].id));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unauthorized");
        void router.replace("/app");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearToken();
    void router.push("/login");
  }

  async function onCreateUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) return;

    setUnitError(null);
    setUnitBusy(true);
    try {
      const unit = await createUnit(token, {
        name,
        territory,
        competencies,
      });
      setUnits((prev) => {
        const next = [...prev, unit].sort((a, b) => a.name.localeCompare(b.name, "pl"));
        if (!projectUnitId) setProjectUnitId(String(unit.id));
        return next;
      });
      setStats((prev) =>
        prev ? { ...prev, units_total: prev.units_total + 1 } : prev,
      );
      setName("");
      setTerritory("");
      setCompetencies("");
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : "Nie udało się dodać jednostki");
    } finally {
      setUnitBusy(false);
    }
  }

  async function onDeleteUnit(unitId: string) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm("Usunąć jednostkę oraz powiązane zgłoszenia i projekty?")) return;

    try {
      await deleteUnit(token, unitId);
      setUnits((prev) => prev.filter((u) => u.id !== unitId));
      setProjects((prev) => prev.filter((p) => p.unit_id !== unitId));
      const nextStats = await fetchAdminStats(token);
      setStats(nextStats);
      setProjectUnitId((current) => {
        if (current !== unitId) return current;
        const remaining = units.filter((u) => u.id !== unitId);
        return remaining[0]?.id ?? "";
      });
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : "Nie udało się usunąć jednostki");
    }
  }

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !projectUnitId) return;

    setProjectError(null);
    setProjectBusy(true);
    try {
      const project = await createProject(token, {
        unit_id: projectUnitId,
        name: projectName,
        description: projectDescription,
      });
      setProjects((prev) => [project, ...prev]);
      setStats((prev) =>
        prev ? { ...prev, projects_total: prev.projects_total + 1 } : prev,
      );
      setProjectName("");
      setProjectDescription("");
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Nie udało się dodać projektu");
    } finally {
      setProjectBusy(false);
    }
  }

  async function onDeleteProject(projectId: string) {
    const token = getToken();
    if (!token) return;
    if (!window.confirm("Usunąć ten projekt?")) return;

    try {
      await deleteProject(token, projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setStats((prev) =>
        prev ? { ...prev, projects_total: Math.max(0, prev.projects_total - 1) } : prev,
      );
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Nie udało się usunąć projektu");
    }
  }

  async function onReassignProject(projectId: string, unitId: string) {
    const token = getToken();
    if (!token) return;

    try {
      const updated = await updateProject(token, projectId, { unit_id: unitId });
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
      setProjectError(null);
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Nie udało się przydzielić projektu");
    }
  }

  async function onChangeReportStatus(reportId: string, status: ReportStatus) {
    const token = getToken();
    if (!token) return;

    try {
      const updated = await updateReportStatus(token, reportId, status);
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setReportError(null);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Nie udało się zmienić statusu");
    }
  }

  if (loading || !admin || !stats) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <p className="animate-soft-in text-[var(--muted)]">{error ?? "Ładowanie panelu…"}</p>
      </main>
    );
  }

  return (
    <main className="animate-soft-in mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-8">
        <div>
          <p className="font-display text-sm font-semibold text-[var(--accent)]">MaloHUB</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
            Panel administracyjny
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Jednostki, projekty i odpowiedzialność ·{" "}
            {admin.full_name || `${admin.name} ${admin.surname}`.trim() || admin.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app" className="btn-ghost">
            Aplikacja
          </Link>
          <button type="button" onClick={logout} className="btn-ghost">
            Wyloguj
          </button>
        </div>
      </header>

      <section className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
        <Stat label="Użytkownicy" value={stats.users_total} />
        <Stat label="Jednostki" value={stats.units_total} />
        <Stat label="Projekty" value={stats.projects_total} />
        <Stat label="Zgłoszenia" value={stats.reports_total} />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Jednostki organizacyjne</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Dodaj jednostkę i określ teren oraz kompetencje - mieszkańcy będą do niej kierować
          zgłoszenia.
        </p>

        <form onSubmit={onCreateUnit} className="surface mt-4 space-y-4 p-5">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Nazwa</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
              placeholder="np. Wydział Dróg"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Teren odpowiedzialności</span>
            <textarea
              required
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              className="field min-h-[72px]"
              placeholder="np. dzielnica Śródmieście, ulice X–Y"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Kompetencje</span>
            <textarea
              required
              value={competencies}
              onChange={(e) => setCompetencies(e.target.value)}
              className="field min-h-[72px]"
              placeholder="np. dziury w jezdni, oznakowanie, oświetlenie uliczne"
            />
          </label>
          {unitError && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {unitError}
            </p>
          )}
          <button type="submit" disabled={unitBusy} className="btn-primary">
            {unitBusy ? "Zapisywanie…" : "Dodaj jednostkę"}
          </button>
        </form>

        <ul className="mt-6 space-y-3">
          {units.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Brak jednostek - dodaj pierwszą powyżej.</li>
          )}
          {units.map((unit) => (
            <li key={unit.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{unit.name}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">Teren:</span> {unit.territory}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">Kompetencje:</span>{" "}
                    {unit.competencies}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteUnit(unit.id)}
                  className="btn-ghost text-sm"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-base font-semibold">Projekty → jednostki</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Utwórz projekt i przydziel go do jednostki. Mieszkaniec w czacie wpisze nazwę / słowo
          kluczowe i dostanie informację zwrotną o tym projekcie.
        </p>

        {units.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Najpierw dodaj jednostkę organizacyjną powyżej.
          </p>
        ) : (
          <form onSubmit={onCreateProject} className="surface mt-4 space-y-4 p-5">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">
                Przydziel do jednostki organizacyjnej
              </span>
              <select
                required
                value={projectUnitId}
                onChange={(e) => setProjectUnitId(e.target.value)}
                className="field"
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Nazwa projektu (słowo kluczowe w czacie)</span>
              <input
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="field"
                placeholder="np. Remont chodników 2026"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Opis (informacja zwrotna dla AI)</span>
              <textarea
                required
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="field min-h-[100px]"
                placeholder="Czego dotyczy projekt, kogo szukacie, jakie potrzeby…"
              />
            </label>
            {projectError && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {projectError}
              </p>
            )}
            <button type="submit" disabled={projectBusy} className="btn-primary">
              {projectBusy ? "Zapisywanie…" : "Utwórz i przydziel projekt"}
            </button>
          </form>
        )}

        <ul className="mt-6 space-y-3">
          {projects.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Brak projektów - dodaj pierwszy powyżej.</li>
          )}
          {projects.map((project) => (
            <li key={project.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{project.name}</p>
                  <p className="mt-2 text-sm leading-relaxed">{project.description}</p>
                  <label className="mt-3 block max-w-sm text-sm">
                    <span className="mb-1.5 block text-[var(--muted)]">Przydzielona jednostka</span>
                    <select
                      value={project.unit_id}
                      onChange={(e) =>
                        void onReassignProject(project.id, e.target.value)
                      }
                      className="field"
                      disabled={units.length === 0}
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteProject(project.id)}
                  className="btn-ghost text-sm"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-base font-semibold">Sprawy mieszkańców</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Sprawy otwiera AI / system - Ty ustawiasz status widoczny dla mieszkańca.
        </p>
        {reportError && (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {reportError}
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {reports.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Brak spraw w systemie.</li>
          )}
          {reports.map((report) => (
            <li key={report.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {report.unit_name ?? "Nieprzydzielona"} ·{" "}
                    {report.author_name || report.author_email || "autor"}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {report.description}
                  </p>
                </div>
                <label className="block min-w-[10rem] text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Status</span>
                  <select
                    value={report.status ?? "nowe"}
                    onChange={(e) =>
                      void onChangeReportStatus(report.id, e.target.value as ReportStatus)
                    }
                    className="field"
                  >
                    {REPORT_STATUSES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-base font-semibold">Lista użytkowników</h2>
        <div className="surface mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Imię</th>
                <th className="px-4 py-3 font-medium">Nazwisko</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">Rola</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-soft)]"
                >
                  <td className="px-4 py-3 font-mono text-[var(--muted)]">{user.id}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.name || "—"}</td>
                  <td className="px-4 py-3">{user.surname || "—"}</td>
                  <td className="px-4 py-3">{user.phone_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.role === "admin"
                          ? "font-medium text-[var(--accent)]"
                          : "text-[var(--muted)]"
                      }
                    >
                      {user.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
