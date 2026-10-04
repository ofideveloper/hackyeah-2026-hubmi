/** Browser talks to Next.js BFF at /api/*; the BFF proxies to the internal FastAPI service. */
const API_BASE = "/api";

/** Zgodne z API `UserPublic` (`apps/api/app/models.py`). */
export type User = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone_number: string | null;
  full_name?: string | null;
  role: "user" | "admin" | "specialist" | string;
  sector?: Sector | null;
  organization?: string | null;
  /** Opis specjalizacji mentora (rola `specialist`) */
  mentor_bio?: string | null;
};

/** Co czeka na decyzję zespołu — liczniki w nawigacji panelu admina. */
export type AdminInbox = {
  ideas: number;
  tester_signups: number;
  proposals: number;
  messages: number;
};

export type AdminStats = {
  users_total: number;
  users_active: number;
  admins_total: number;
};

export type ProjectProposalStatus = "nowe" | "zaakceptowane" | "odrzucone";

export type ProjectProposal = {
  id: string;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  name: string;
  description: string;
  status: ProjectProposalStatus | string;
  created_at: string;
};

type AuthError = {
  detail: string | { msg: string }[];
};

function getErrorMessage(error: AuthError): string {
  if (typeof error.detail === "string") {
    return error.detail;
  }
  if (Array.isArray(error.detail) && error.detail[0]?.msg) {
    return error.detail[0].msg;
  }
  return "Something went wrong";
}

async function parseError(res: Response): Promise<string> {
  try {
    const error = (await res.json()) as AuthError;
    return getErrorMessage(error);
  } catch {
    return "Request failed";
  }
}

export async function registerUser(payload: {
  email: string;
  password: string;
  name: string;
  surname: string;
  phone_number?: string | null;
}): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<User>;
}

/** BFF zapisuje JWT w cookie HttpOnly — odpowiedź nie zawiera tokena. */
export async function loginUser(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({
    username: email,
    password,
  });

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function logoutUser(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/logout`, { method: "POST", keepalive: true });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchMe(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    cache: "no-store",
  });

  if (!res.ok) {
    // ApiError ze statusem — AuthProvider kasuje sesję tylko przy 401, nie przy 502/sieci
    throw new ApiError(await parseError(res), res.status);
  }

  return res.json() as Promise<User>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<AdminStats>;
}

export async function fetchAdminUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<User[]>;
}

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LocationRequestKind = "area" | "gps";

export type ChatMode = "clarify" | "report" | "catalog" | "intake";

/** Projekt z katalogu polecony w czacie — `unit_name` niesie nazwę kategorii. */
export type ChatProject = {
  id: string;
  name: string;
  description: string;
  unit_name: string | null;
};

export type NewProjectDraft = {
  name: string;
  description: string;
};

/** Podobne przypadki — tylko liczby i zatwierdzone fiszki, bez cudzych opisów. */
export type SimilarCases = {
  area_name: string | null;
  needs_last_30_days: number;
  related_ideas: { id: string; name: string; description: string; stage: IdeaStage }[];
};

export type ChatReply = {
  reply: string;
  similar: SimilarCases | null;
  chat_id: string | null;
  mode: ChatMode;
  suggested_projects: ChatProject[];
  /** Brak dopasowania w bazie — UI otwiera okno zgłoszenia nowego projektu. */
  new_project_draft: NewProjectDraft | null;
  project_proposal: ProjectProposal | null;
  location_request: LocationRequestKind | null;
};

export async function sendChatMessage(
  message: string,
  history: ChatHistoryMessage[] = [],
  mode?: ChatMode | null,
  chatId?: string | null,
): Promise<ChatReply> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      history,
      ...(mode ? { mode } : {}),
      ...(chatId ? { chat_id: chatId } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as ChatReply;
  const resolvedMode: ChatMode =
    data.mode === "report" ||
    data.mode === "catalog" ||
    data.mode === "intake" ||
    data.mode === "clarify"
      ? data.mode
      : "clarify";
  return {
    reply: data.reply,
    similar: data.similar ?? null,
    chat_id: data.chat_id ?? null,
    new_project_draft: data.new_project_draft ?? null,
    mode: resolvedMode,
    suggested_projects: data.suggested_projects ?? [],
    project_proposal: data.project_proposal ?? null,
    location_request:
      data.location_request === "area" || data.location_request === "gps"
        ? data.location_request
        : null,
  };
}

export async function createProjectProposal(
  payload: NewProjectDraft,
): Promise<ProjectProposal> {
  const res = await fetch(`${API_BASE}/project-proposals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<ProjectProposal>;
}

export async function fetchProjectProposals(): Promise<ProjectProposal[]> {
  const res = await fetch(`${API_BASE}/admin/project-proposals`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<ProjectProposal[]>;
}

export async function acceptProjectProposal(
  proposalId: string,
): Promise<ProjectProposal> {
  const res = await fetch(`${API_BASE}/admin/project-proposals/${proposalId}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<ProjectProposal>;
}

export async function rejectProjectProposal(
  proposalId: string,
): Promise<ProjectProposal> {
  const res = await fetch(`${API_BASE}/admin/project-proposals/${proposalId}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<ProjectProposal>;
}

// —— Zasobnik wiedzy ——

export type KnowledgeArea = {
  id: string;
  name: string;
  innovations: number;
};

export type InnovationSummary = {
  id: string;
  name: string;
  category_id: string;
  /** Sekcja „Na czym polega rozwiązanie?” */
  solution: string;
  /** Sekcja „Jakich problemów dotyczy innowacja?” */
  problem: string;
  has_video: boolean;
};

export type InnovationDetail = {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  sections: { title: string; body: string }[];
  source_url: string | null;
  video_url: string | null;
  folder_url: string | null;
};

export type KnowledgeResourceKind = "wyzwanie" | "material";

export type KnowledgeResource = {
  id: string;
  kind: KnowledgeResourceKind;
  title: string;
  summary: string;
  /** Etykieta formy, np. „Raport”, „Film” */
  format: string;
  url: string | null;
  category_id: string | null;
  updated_at: string;
};

export type KnowledgeResourceInput = Omit<KnowledgeResource, "id" | "updated_at">;

export type KnowledgeOverview = {
  areas: KnowledgeArea[];
  innovations: InnovationSummary[];
  resources: KnowledgeResource[];
};

export type AreaTrend = {
  /** null = potrzeby, na które baza nie miała odpowiedzi */
  category_id: string | null;
  name: string;
  total: number;
  last_30_days: number;
  previous_30_days: number;
  weekly: number[];
};

export type NeedTrends = {
  weeks: string[];
  areas: AreaTrend[];
  /** `similar` — ile innych potrzeb bez odpowiedzi dotyczy tego samego */
  unmet: { created_at: string; summary: string; similar: number }[];
  total: number;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<T>;
}

export async function fetchKnowledge(): Promise<KnowledgeOverview> {
  return jsonOrThrow(await fetch(`${API_BASE}/knowledge`, { cache: "no-store" }));
}

export async function fetchInnovation(id: string): Promise<InnovationDetail> {
  return jsonOrThrow(await fetch(`${API_BASE}/knowledge/innovations/${id}`));
}

export async function saveKnowledgeResource(
  payload: KnowledgeResourceInput,
  resourceId?: string | null,
): Promise<KnowledgeResource> {
  const base = `${API_BASE}/admin/knowledge/resources`;
  return jsonOrThrow(
    await fetch(resourceId ? `${base}/${resourceId}` : base, {
      method: resourceId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteKnowledgeResource(resourceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/knowledge/resources/${resourceId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function refreshInnovationLibrary(): Promise<{ added: number }> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/knowledge/refresh`, {
      method: "POST",
    }),
  );
}

export async function fetchNeedTrends(): Promise<NeedTrends> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/trends`, { cache: "no-store" }),
  );
}

// --- Kreator pomysłów (`apps/api/app/routes/ideas.py`) ---

export type IdeaStage = "pomysl" | "prototyp" | "test_mikroskala" | "dobra_praktyka";

/** Fiszka = `ProposalOfNewProject` w API: `name` to tytuł, `description` to krótki opis. */
export type IdeaInput = {
  name: string;
  description: string;
  essence: string;
  audience: string;
  stage: IdeaStage;
  /** Obszar jest wymagany; `null` tylko w pustym formularzu */
  category_id: string | null;
  canvas: Record<string, string>;
};

export type Idea = Omit<IdeaInput, "canvas" | "category_id"> & {
  id: string;
  category_id: string;
  author_name: string | null;
  category_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  modified_at: string;
};

/** Fiszka autora — razem z roboczą canvą. */
export type MyIdea = Idea & {
  canvas: Record<string, string>;
  /** Komentarz zespołu ROPS do decyzji o fiszce */
  admin_note: string;
};

export type IdeaStatus = Idea["status"];

/** Fiszka w panelu admina — pełne dane autora i canva. */
export type AdminIdea = MyIdea & {
  author_full_name: string | null;
  author_email: string | null;
};

export type IdeaAssistantAction = "develop" | "unconventional" | "canvas" | "visualize" | "ask";

export type IdeaAssistantReply = {
  reply: string;
  svg: string | null;
  /** Akcja „canvas”: propozycje rozbite na pola canvy */
  canvas: Record<string, string> | null;
};

export type GrantQuestion = { key: string; label: string; hint: string };

export type GrantCall = {
  id: string;
  title: string;
  description: string;
  opens_on: string;
  closes_on: string;
  questions: GrantQuestion[];
  is_open: boolean;
  applications_submitted: number | null;
};

export type GrantCallInput = Pick<
  GrantCall,
  "title" | "description" | "opens_on" | "closes_on" | "questions"
>;

export type GrantApplication = {
  id: string;
  call_id: string;
  idea_id: string | null;
  idea_title: string | null;
  answers: Record<string, string>;
  status: "szkic" | "zlozony";
  updated_at: string;
  submitted_at: string | null;
  author_name: string | null;
  author_email: string | null;
};

function jsonRequest(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export async function fetchIdeas(): Promise<Idea[]> {
  return jsonOrThrow(await fetch(`${API_BASE}/ideas`, { cache: "no-store" }));
}

export async function fetchMyIdeas(): Promise<MyIdea[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/ideas/mine`, { cache: "no-store" }),
  );
}

export async function saveIdea(
  payload: IdeaInput,
  ideaId?: string | null,
): Promise<MyIdea> {
  const base = `${API_BASE}/ideas`;
  return jsonOrThrow(
    await fetch(
      ideaId ? `${base}/${ideaId}` : base,
      jsonRequest(ideaId ? "PATCH" : "POST", payload),
    ),
  );
}

export async function deleteIdea(ideaId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/ideas/${ideaId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchAdminIdeas(): Promise<AdminIdea[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/ideas`, { cache: "no-store" }),
  );
}

export async function setIdeaStatus(
  ideaId: string,
  status: IdeaStatus,
  note = "",
): Promise<AdminIdea> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/ideas/${ideaId}`, jsonRequest("PATCH", { status, note })),
  );
}

export async function fetchAdminInbox(): Promise<AdminInbox> {
  return jsonOrThrow(await fetch(`${API_BASE}/admin/inbox`, { cache: "no-store" }));
}

// --- Middleman Innowacji (`apps/api/app/routes/middleman.py`) ---

export type InstitutionKind = "jst" | "cus" | "ops" | "ngo" | "pes" | "inna";

export type AdaptInput = {
  innovation_id: string;
  institution_kind: InstitutionKind;
  institution_name: string;
  area: string;
  audience: string;
  resources: string;
  budget: string;
  constraints: string;
};

export type ServiceCard = {
  innovation_id: string;
  innovation_name: string;
  /** Markdown */
  service_card: string;
};

export async function adaptInnovation(payload: AdaptInput): Promise<ServiceCard> {
  return jsonOrThrow(await fetch(`${API_BASE}/admin/middleman/adapt`, jsonRequest("POST", payload)));
}

export async function askIdeaAssistant(
  action: IdeaAssistantAction,
  draft: IdeaInput,
  question = "",
): Promise<IdeaAssistantReply> {
  const { name, description, essence, audience, stage, canvas } = draft;
  const idea = { name, description, essence, audience, stage, canvas };
  return jsonOrThrow(
    await fetch(`${API_BASE}/ideas/assistant`, jsonRequest("POST", { action, idea, question })),
  );
}

export async function fetchOpenGrantCalls(): Promise<GrantCall[]> {
  return jsonOrThrow(await fetch(`${API_BASE}/grant-calls`, { cache: "no-store" }));
}

export async function fetchMyGrantApplication(
  callId: string,
): Promise<GrantApplication | null> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/grant-calls/${callId}/application`, {
      cache: "no-store",
    }),
  );
}

export async function saveGrantApplication(
  callId: string,
  payload: { idea_id: string | null; answers: Record<string, string>; submit: boolean },
): Promise<GrantApplication> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/grant-calls/${callId}/application`, jsonRequest("PUT", payload)),
  );
}

export async function fetchAdminGrantCalls(): Promise<GrantCall[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/grant-calls`, { cache: "no-store" }),
  );
}

export async function saveGrantCall(
  payload: GrantCallInput,
  callId?: string | null,
): Promise<GrantCall> {
  const base = `${API_BASE}/admin/grant-calls`;
  return jsonOrThrow(
    await fetch(
      callId ? `${base}/${callId}` : base,
      jsonRequest(callId ? "PATCH" : "POST", payload),
    ),
  );
}

export async function deleteGrantCall(callId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/grant-calls/${callId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchGrantApplications(
  callId: string,
): Promise<GrantApplication[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/grant-calls/${callId}/applications`, {
      cache: "no-store",
    }),
  );
}

// --- Tester innowacji (`apps/api/app/routes/testing.py`) ---

/** `innowacja` = Biblioteka Innowacji, `pomysl` = zatwierdzona fiszka z Kreatora. */
export type TestTargetKind = "innowacja" | "pomysl";

export type TestSolution = {
  kind: TestTargetKind;
  id: string;
  name: string;
  summary: string;
  category_name: string | null;
  rating_avg: number | null;
  reviews_count: number;
  testers_count: number;
};

export type SolutionReviewInput = {
  rating: number;
  feedback: string;
  improvement: string;
};

export type SolutionReview = SolutionReviewInput & {
  id: string;
  target_kind: TestTargetKind;
  target_id: string;
  target_name: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminSolutionReview = SolutionReview & {
  author_full_name: string | null;
  author_email: string | null;
};

export type TesterSignup = {
  id: string;
  target_kind: TestTargetKind;
  target_id: string;
  target_name: string | null;
  motivation: string;
  status: IdeaStatus;
  created_at: string;
};

export type AdminTesterSignup = TesterSignup & {
  tester_full_name: string | null;
  tester_email: string | null;
};

export type MyTesting = { signups: TesterSignup[]; reviews: SolutionReview[] };

type TestTarget = Pick<TestSolution, "kind" | "id">;

function solutionUrl(target: TestTarget): string {
  return `${API_BASE}/testing/solutions/${target.kind}/${target.id}`;
}

async function deleteOrThrow(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchTestSolutions(): Promise<TestSolution[]> {
  return jsonOrThrow(await fetch(`${API_BASE}/testing/solutions`, { cache: "no-store" }));
}

export async function fetchSolutionReviews(target: TestTarget): Promise<SolutionReview[]> {
  return jsonOrThrow(await fetch(`${solutionUrl(target)}/reviews`, { cache: "no-store" }));
}

export async function fetchMyTesting(): Promise<MyTesting> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/testing/mine`, { cache: "no-store" }),
  );
}

export async function createTesterSignup(
  target: TestTarget,
  motivation: string,
): Promise<TesterSignup> {
  return jsonOrThrow(
    await fetch(`${solutionUrl(target)}/signups`, jsonRequest("POST", { motivation })),
  );
}

export async function withdrawTesterSignup(signupId: string): Promise<void> {
  return deleteOrThrow(`${API_BASE}/testing/signups/${signupId}`);
}

export async function saveSolutionReview(
  target: TestTarget,
  payload: SolutionReviewInput,
): Promise<SolutionReview> {
  return jsonOrThrow(await fetch(`${solutionUrl(target)}/review`, jsonRequest("PUT", payload)));
}

export async function deleteSolutionReview(target: TestTarget): Promise<void> {
  return deleteOrThrow(`${solutionUrl(target)}/review`);
}

export async function fetchAdminTesterSignups(): Promise<AdminTesterSignup[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/testing/signups`, {
      cache: "no-store",
    }),
  );
}

export async function setTesterSignupStatus(
  signupId: string,
  status: IdeaStatus,
): Promise<AdminTesterSignup> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/admin/testing/signups/${signupId}`,
      jsonRequest("PATCH", { status }),
    ),
  );
}

export async function fetchAdminSolutionReviews(): Promise<AdminSolutionReview[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/testing/reviews`, {
      cache: "no-store",
    }),
  );
}

export async function deleteAdminSolutionReview(reviewId: string): Promise<void> {
  return deleteOrThrow(`${API_BASE}/admin/testing/reviews/${reviewId}`);
}

// --- Platforma komunikacji (apps/api/app/routes/communication.py) ---

export type Sector = "ngo" | "jst" | "biznes" | "nauka";
export type ConversationKind = "pytanie" | "mentoring" | "partnerstwo";
export type ConversationStatus = "otwarta" | "zamknieta";
export type ListingKind = "szukam" | "oferuje";

export type Mentor = {
  id: string;
  name: string | null;
  organization: string | null;
  sector: Sector | null;
  bio: string | null;
};

export type ListingInput = {
  kind: ListingKind;
  title: string;
  description: string;
  sought_sector: Sector | null;
};

export type Listing = ListingInput & {
  id: string;
  author_name: string | null;
  author_organization: string | null;
  author_sector: Sector | null;
  created_at: string;
  is_mine: boolean;
};

export type ThreadMessage = {
  id: string;
  author_name: string | null;
  is_mine: boolean;
  body: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  kind: ConversationKind;
  subject: string;
  status: ConversationStatus;
  counterpart_name: string | null;
  /** Tylko dla admina w pytaniach do ROPS */
  counterpart_email: string | null;
  unread: boolean;
  created_at: string;
  last_message_at: string;
};

export type ConversationDetail = Conversation & { messages: ThreadMessage[] };

export type ConversationInput = {
  kind: "pytanie" | "mentoring";
  subject: string;
  body: string;
  mentor_id?: string;
};

export type ProfileInput = {
  sector: Sector | null;
  organization: string;
  mentor_bio: string;
};

/** Błąd z kodem HTTP — odpytywanie rozmowy musi odróżnić 401/404 od chwilowej awarii. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchMentors(): Promise<Mentor[]> {
  return jsonOrThrow(await fetch(`${API_BASE}/mentors`, { cache: "no-store" }));
}

/** Token opcjonalny — z nim API oznacza własne ogłoszenia (`is_mine`). */
export async function fetchListings(): Promise<Listing[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/partnerships`, {
      cache: "no-store",
    }),
  );
}

export async function createListing(payload: ListingInput): Promise<Listing> {
  return jsonOrThrow(await fetch(`${API_BASE}/partnerships`, jsonRequest("POST", payload)));
}

export async function deleteListing(listingId: string): Promise<void> {
  return deleteOrThrow(`${API_BASE}/partnerships/${listingId}`);
}

export async function contactListingAuthor(
  listingId: string,
  body: string,
): Promise<ConversationDetail> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/partnerships/${listingId}/contact`,
      jsonRequest("POST", { body }),
    ),
  );
}

export async function fetchConversations(): Promise<Conversation[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/conversations`, { cache: "no-store" }),
  );
}

export async function createConversation(
  payload: ConversationInput,
): Promise<ConversationDetail> {
  return jsonOrThrow(await fetch(`${API_BASE}/conversations`, jsonRequest("POST", payload)));
}

export async function fetchConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }
  return res.json() as Promise<ConversationDetail>;
}

export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<ConversationDetail> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/conversations/${conversationId}`,
      jsonRequest("PATCH", { status }),
    ),
  );
}

export async function sendThreadMessage(
  conversationId: string,
  body: string,
): Promise<ConversationDetail> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/conversations/${conversationId}/messages`,
      jsonRequest("POST", { body }),
    ),
  );
}

export async function updateMyProfile(payload: ProfileInput): Promise<User> {
  return jsonOrThrow(await fetch(`${API_BASE}/users/me`, jsonRequest("PATCH", payload)));
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/users/me/password`,
    jsonRequest("POST", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  );
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

/** Nadanie lub odebranie roli mentora. */
export async function setUserRole(
  userId: string,
  role: "user" | "specialist",
): Promise<User> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/users/${userId}`, jsonRequest("PATCH", { role })),
  );
}
