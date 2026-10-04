import { useEffect, useState } from "react";

import {
  fetchAdminReports,
  fetchUnits,
  updateReportStatus,
  updateReportUnit,
  type OrganizationalUnit,
  type Report,
  type ReportStatus,
} from "@/lib/api";

const REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
  { value: "nowe", label: "Przyjęte" },
  { value: "w_toku", label: "W trakcie" },
  { value: "zakonczone", label: "Zakończone" },
];

const KIND_LABEL: Record<string, string> = {
  problem: "Problem",
  wydarzenie: "Wydarzenie",
  informacja: "Informacja",
};

function authorLabel(report: Report): string {
  if (report.author_name?.trim()) return report.author_name.trim();
  if (report.author_email?.trim()) return report.author_email.trim();
  return "Nieznany autor";
}

export function AdminReportsView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAdminReports(), fetchUnits()])
      .then(([nextReports, nextUnits]) => {
        setReports(nextReports);
        setUnits(nextUnits);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać spraw"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onChangeStatus(reportId: string, status: ReportStatus) {
    try {
      const updated = await updateReportStatus(reportId, status);
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić statusu");
    }
  }

  async function onChangeUnit(reportId: string, unitId: string) {
    try {
      const updated = await updateReportUnit(reportId, unitId || null);
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić jednostki");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]" role="status">Ładowanie spraw…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {reports.length === 0 && (
          <li className="text-sm text-[var(--muted)]">Brak spraw w systemie.</li>
        )}
        {reports.map((report) => (
          <li key={report.id} className="surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{report.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {KIND_LABEL[report.kind] ?? report.kind}
                  {" · "}
                  {authorLabel(report)}
                  {report.author_email && report.author_name
                    ? ` · ${report.author_email}`
                    : ""}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                  {report.description}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {new Date(report.created_at).toLocaleString("pl-PL")}
                </p>
              </div>
              <div className="flex min-w-[12rem] flex-col gap-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Jednostka</span>
                  <select
                    value={report.unit_id ?? ""}
                    onChange={(e) => void onChangeUnit(report.id, e.target.value)}
                    className="field"
                  >
                    <option value="">Nieprzydzielona</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">Status</span>
                  <select
                    value={report.status ?? "nowe"}
                    onChange={(e) =>
                      void onChangeStatus(report.id, e.target.value as ReportStatus)
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
