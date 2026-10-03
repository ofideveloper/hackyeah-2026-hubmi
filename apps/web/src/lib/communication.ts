import type {
  Conversation,
  ConversationKind,
  ConversationStatus,
  ListingKind,
  Sector,
} from "@/lib/api";

export const SECTOR_LABEL: Record<Sector, string> = {
  ngo: "Organizacja pozarządowa",
  jst: "Samorząd",
  biznes: "Biznes",
  nauka: "Nauka",
};

export const SECTORS = Object.keys(SECTOR_LABEL) as Sector[];

export const THREAD_KIND_LABEL: Record<ConversationKind, string> = {
  pytanie: "Pytanie do ROPS",
  mentoring: "Rozmowa z mentorem",
  partnerstwo: "Partnerstwo",
};

export const THREAD_STATUS: Record<ConversationStatus, { label: string; className: string }> = {
  otwarta: { label: "Otwarta", className: "status-pill status-pill-progress" },
  zamknieta: { label: "Zamknięta", className: "status-pill status-pill-done" },
};

export const LISTING_KIND_LABEL: Record<ListingKind, string> = {
  szukam: "Szukam",
  oferuje: "Oferuję",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  user: "Użytkownik",
  specialist: "Mentor",
};

/** Limity zgodne z `apps/api/app/models.py`. */
export const MESSAGE_BODY_MAX = 2000;
export const THREAD_SUBJECT_MAX = 160;
export const ORGANIZATION_MAX = 160;
export const MENTOR_BIO_MAX = 1000;

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

export function unreadCount(threads: Conversation[]): number {
  return threads.filter((thread) => thread.unread).length;
}
