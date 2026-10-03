import { useEffect, useState } from "react";

import {
  fetchAdminReports,
  updateReportStatus,
  type Report,
  type ReportStatus,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

const REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
  { value: "nowe", label: "Przyjęte" },
  { value: "w_toku", label: "W trakcie" },
  { value: "zakonczone", label: "Zakończone" },
];

export function AdminReportsView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetchAdminReports(token)
      .then(setReports)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Nie udało się pobrać spraw"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onChangeStatus(reportId: string, status: ReportStatus) {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await updateReportStatus(token, reportId, status);
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić statusu");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Ładowanie spraw…</p>;
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
                  {report.unit_name ?? `Jednostka #${report.unit_id}`} · user #{report.author_id}
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
          </li>
        ))}
      </ul>
    </div>
  );
}
