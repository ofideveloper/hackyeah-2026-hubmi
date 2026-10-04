import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AssistantChat } from "@/components/AssistantChat";
import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations, fetchMyReports, type Report } from "@/lib/api";
import { unreadCount } from "@/lib/communication";

const STATUS_LABEL: Record<string, string> = {
  nowe: "Przyjęte",
  w_toku: "W trakcie",
  zakonczone: "Zakończone",
};

function statusClass(status: string): string {
  if (status === "zakonczone") return "status-pill status-pill-done";
  if (status === "w_toku") return "status-pill status-pill-progress";
  return "status-pill status-pill-new";
}

export default function AppHomePage() {
  const router = useRouter();
  const { status, user, sessionHint } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [unread, setUnread] = useState(0);
  const [focusChat, setFocusChat] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      void router.replace("/login");
      return;
    }
    if (!sessionHint) return;

    let cancelled = false;
    setLoadingData(true);
    Promise.all([
      fetchMyReports().catch(() => [] as Report[]),
      fetchConversations().catch(() => []),
    ])
      .then(([nextReports, threads]) => {
        if (cancelled) return;
        setReports(nextReports);
        setUnread(unreadCount(threads));
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, sessionHint, router]);

  useEffect(() => {
    if (!router.isReady || status !== "authenticated" || loadingData) return;

    const activate = () => {
      const hash = router.asPath.includes("#")
        ? router.asPath.slice(router.asPath.indexOf("#") + 1)
        : typeof window !== "undefined"
          ? window.location.hash.replace(/^#/, "")
          : "";
      if (hash !== "opiekun") {
        setFocusChat(false);
        return;
      }
      const input = document.getElementById("chat-message-input");
      (input ?? document.getElementById("opiekun"))?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setFocusChat(true);
      if (input instanceof HTMLTextAreaElement) {
        window.setTimeout(() => input.focus({ preventScroll: true }), 280);
      }
    };

    activate();
    window.addEventListener("hashchange", activate);
    return () => window.removeEventListener("hashchange", activate);
  }, [router.isReady, router.asPath, status, loadingData]);

  if (status === "loading" || status === "anonymous" || !user || loadingData) {
    return (
      <main id="tresc" tabIndex={-1} className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <p className="text-[var(--muted)]" role="status">Ładowanie…</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Moja przestrzeń · MaloHUB</title>
      </Head>

      <SiteHeader
        width="full"
        actions={<AppNav current="app" unreadKontakt={unread} />}
      />

      <main id="tresc" tabIndex={-1} className="kb-page mx-auto max-w-3xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14">
        <header className="animate-fade-up">
          <p className="kb-meta">Twoja przestrzeń</p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Porozmawiaj z opiekunem i{" "}
            <span className="text-[var(--accent)]">śledź sprawy</span>
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Witaj
            {user.name ? `, ${user.name}` : ""}. Opisz sprawę poniżej — statusy zobaczysz, gdy
            pojawią się w systemie.
          </p>
        </header>

        <section id="opiekun" className="mt-10 scroll-mt-24">
          <AssistantChat
            autoFocus={focusChat}
            userName={user.full_name || `${user.name} ${user.surname}`.trim()}
            onReportCreated={(report) => {
              setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
              if (sessionHint) {
                void fetchMyReports()
                  .then(setReports)
                  .catch(() => undefined);
              }
            }}
          />
        </section>

        <section id="moje-sprawy" className="mt-14 scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Twoje sprawy</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Statusy aktualizuje zespół — Ty tylko śledzisz postęp.
          </p>
          <ul className="mt-6 space-y-3">
            {reports.length === 0 && (
              <li className="surface px-5 py-6 text-sm leading-relaxed text-[var(--muted)]">
                Na razie cisza. Gdy opiekun lub system otworzy sprawę w Twoim imieniu, zobaczysz
                ją tutaj wraz ze statusem.
              </li>
            )}
            {reports.map((report) => (
              <li key={report.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{report.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {report.unit_name ?? "Jednostka do przydzielenia"}
                    </p>
                  </div>
                  <span className={statusClass(report.status ?? "nowe")}>
                    {STATUS_LABEL[report.status ?? "nowe"] ?? report.status}
                  </span>
                </div>
                {report.description && (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                    {report.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-[var(--muted)]">
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
