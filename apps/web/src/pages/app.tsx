import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { AssistantChat } from "@/components/AssistantChat";
import { AppNav, SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations } from "@/lib/api";
import { unreadCount } from "@/lib/communication";

export default function AppHomePage() {
  const router = useRouter();
  const { status, user } = useAuth();
  const [loadingData, setLoadingData] = useState(true);
  const [unread, setUnread] = useState(0);
  const [focusChat, setFocusChat] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      void router.replace("/login");
      return;
    }

    let cancelled = false;
    setLoadingData(true);
    fetchConversations()
      .catch(() => [])
      .then((threads) => {
        if (cancelled) return;
        setUnread(unreadCount(threads));
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, router]);

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
      <main
        id="tresc"
        tabIndex={-1}
        className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6"
      >
        <p className="text-[var(--muted)]" role="status">
          Ładowanie…
        </p>
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

      <main
        id="tresc"
        tabIndex={-1}
        className="kb-page mx-auto max-w-3xl px-6 pb-20 pt-10 sm:px-10 sm:pt-14"
      >
        <header className="animate-fade-up">
          <p className="kb-meta">Twoja przestrzeń</p>
          <h1 className="font-display mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Opisz potrzebę i <span>znajdź rozwiązanie!</span>
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Witaj
            {user.name ? `, ${user.name}` : ""}. Opisz sprawę poniżej — interaktywny asystent
            wskaże sprawdzone innowacje albo przekaże potrzebę zespołowi ROPS.
          </p>
        </header>

        <section id="opiekun" className="mt-10 scroll-mt-24">
          <AssistantChat
            autoFocus={focusChat}
            userName={user.full_name || `${user.name} ${user.surname}`.trim()}
          />
        </section>
      </main>
    </>
  );
}
