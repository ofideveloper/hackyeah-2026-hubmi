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

export type AdminStats = {
  users_total: number;
  users_active: number;
  admins_total: number;
  units_total: number;
  reports_total: number;
  projects_total: number;
};

export type OrganizationalUnit = {
  id: string;
  name: string;
  territory: string;
  competencies: string;
  created_at: string;
};

export type Project = {
  id: string;
  unit_id: string;
  unit_name: string | null;
  name: string;
  description: string;
  created_at: string;
};

export type ProjectProposalStatus = "nowe" | "zaakceptowane" | "odrzucone";

export type ProjectProposal = {
  id: string;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  suggested_unit_id: string | null;
  suggested_unit_name: string | null;
  name: string;
  description: string;
  status: ProjectProposalStatus | string;
  created_at: string;
};

export type ReportKind = "problem" | "wydarzenie" | "informacja";
export type ReportStatus = "nowe" | "w_toku" | "zakonczone";

export type Report = {
  id: string;
  author_id: string;
  author_email?: string | null;
  author_name?: string | null;
  unit_id: string | null;
  unit_name: string | null;
  kind: ReportKind | string;
  status: ReportStatus | string;
  title: string;
  description: string;
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

// TODO(cookie-auth): tymczasowe — sesję niesie cookie HttpOnly, BFF sam dokłada `Authorization`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function authHeaders(token: string): HeadersInit {
  return {};
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

export async function fetchMe(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<User>;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<AdminStats>;
}

export async function fetchAdminUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<User[]>;
}

export async function fetchUnits(token: string): Promise<OrganizationalUnit[]> {
  const res = await fetch(`${API_BASE}/units`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<OrganizationalUnit[]>;
}

export async function createUnit(
  token: string,
  payload: { name: string; territory: string; competencies: string },
): Promise<OrganizationalUnit> {
  const res = await fetch(`${API_BASE}/admin/units`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<OrganizationalUnit>;
}

export async function updateUnit(
  token: string,
  unitId: string,
  payload: { name?: string; territory?: string; competencies?: string },
): Promise<OrganizationalUnit> {
  const res = await fetch(`${API_BASE}/admin/units/${unitId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<OrganizationalUnit>;
}

export async function deleteUnit(token: string, unitId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/units/${unitId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchProjects(
  token: string,
  unitId?: string,
): Promise<Project[]> {
  const query = unitId != null ? `?unit_id=${unitId}` : "";
  const res = await fetch(`${API_BASE}/projects${query}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Project[]>;
}

export async function createProject(
  token: string,
  payload: { unit_id: string; name: string; description: string },
): Promise<Project> {
  const res = await fetch(`${API_BASE}/admin/projects`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Project>;
}

export async function updateProject(
  token: string,
  projectId: string,
  payload: { unit_id?: string; name?: string; description?: string },
): Promise<Project> {
  const res = await fetch(`${API_BASE}/admin/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Project>;
}

export async function deleteProject(token: string, projectId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/projects/${projectId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchMyReports(token: string): Promise<Report[]> {
  const res = await fetch(`${API_BASE}/reports`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Report[]>;
}

export async function fetchAdminReports(token: string): Promise<Report[]> {
  const res = await fetch(`${API_BASE}/admin/reports`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Report[]>;
}

export async function updateReportStatus(
  token: string,
  reportId: string,
  status: ReportStatus,
): Promise<Report> {
  const res = await fetch(`${API_BASE}/admin/reports/${reportId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Report>;
}

export async function updateReportUnit(
  token: string,
  reportId: string,
  unitId: string | null,
): Promise<Report> {
  const res = await fetch(`${API_BASE}/admin/reports/${reportId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ unit_id: unitId }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<Report>;
}

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LocationRequestKind = "area" | "gps";

export type ChatMode = "clarify" | "report" | "catalog" | "intake";

/** Projekt z katalogu polecony w czacie — `unit_name` niesie nazwę kategorii. */
export type ChatProject = Pick<Project, "id" | "name" | "description" | "unit_name">;

export type NewProjectDraft = {
  name: string;
  description: string;
};

export type ChatReply = {
  reply: string;
  chat_id: string | null;
  mode: ChatMode;
  suggested_projects: ChatProject[];
  /** Brak dopasowania w bazie — UI otwiera okno zgłoszenia nowego projektu. */
  new_project_draft: NewProjectDraft | null;
  project_proposal: ProjectProposal | null;
  created_report: Report | null;
  report_offer: boolean;
  location_request: LocationRequestKind | null;
};

export async function sendChatMessage(
  token: string | null,
  message: string,
  history: ChatHistoryMessage[] = [],
  mode?: ChatMode | null,
  chatId?: string | null,
): Promise<ChatReply> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? authHeaders(token) : {}),
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
    chat_id: data.chat_id ?? null,
    new_project_draft: data.new_project_draft ?? null,
    mode: resolvedMode,
    suggested_projects: data.suggested_projects ?? [],
    project_proposal: data.project_proposal ?? null,
    created_report: data.created_report ?? null,
    report_offer: Boolean(data.report_offer),
    location_request:
      data.location_request === "area" || data.location_request === "gps"
        ? data.location_request
        : null,
  };
}

export async function createProjectProposal(
  token: string,
  payload: NewProjectDraft,
): Promise<ProjectProposal> {
  const res = await fetch(`${API_BASE}/project-proposals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<ProjectProposal>;
}

export async function fetchProjectProposals(token: string): Promise<ProjectProposal[]> {
  const res = await fetch(`${API_BASE}/admin/project-proposals`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<ProjectProposal[]>;
}

export async function acceptProjectProposal(
  token: string,
  proposalId: string,
  payload: { unit_id: string; name?: string; description?: string },
): Promise<Project> {
  const res = await fetch(`${API_BASE}/admin/project-proposals/${proposalId}/accept`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<Project>;
}

export async function rejectProjectProposal(
  token: string,
  proposalId: string,
): Promise<ProjectProposal> {
  const res = await fetch(`${API_BASE}/admin/project-proposals/${proposalId}/reject`, {
    method: "POST",
    headers: authHeaders(token),
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
  unmet: { created_at: string; summary: string }[];
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
  token: string,
  payload: KnowledgeResourceInput,
  resourceId?: string | null,
): Promise<KnowledgeResource> {
  const base = `${API_BASE}/admin/knowledge/resources`;
  return jsonOrThrow(
    await fetch(resourceId ? `${base}/${resourceId}` : base, {
      method: resourceId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteKnowledgeResource(token: string, resourceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/knowledge/resources/${resourceId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function refreshInnovationLibrary(token: string): Promise<{ added: number }> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/knowledge/refresh`, {
      method: "POST",
      headers: authHeaders(token),
    }),
  );
}

export async function fetchNeedTrends(token: string): Promise<NeedTrends> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/trends`, { headers: authHeaders(token), cache: "no-store" }),
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
export type MyIdea = Idea & { canvas: Record<string, string> };

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

function jsonRequest(token: string, method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  };
}

export async function fetchIdeas(): Promise<Idea[]> {
  return jsonOrThrow(await fetch(`${API_BASE}/ideas`, { cache: "no-store" }));
}

export async function fetchMyIdeas(token: string): Promise<MyIdea[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/ideas/mine`, { headers: authHeaders(token), cache: "no-store" }),
  );
}

export async function saveIdea(
  token: string,
  payload: IdeaInput,
  ideaId?: string | null,
): Promise<MyIdea> {
  const base = `${API_BASE}/ideas`;
  return jsonOrThrow(
    await fetch(
      ideaId ? `${base}/${ideaId}` : base,
      jsonRequest(token, ideaId ? "PATCH" : "POST", payload),
    ),
  );
}

export async function deleteIdea(token: string, ideaId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/ideas/${ideaId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchAdminIdeas(token: string): Promise<AdminIdea[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/ideas`, { headers: authHeaders(token), cache: "no-store" }),
  );
}

export async function setIdeaStatus(
  token: string,
  ideaId: string,
  status: IdeaStatus,
): Promise<AdminIdea> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/ideas/${ideaId}`, jsonRequest(token, "PATCH", { status })),
  );
}

export async function askIdeaAssistant(
  token: string,
  action: IdeaAssistantAction,
  draft: IdeaInput,
  question = "",
): Promise<IdeaAssistantReply> {
  const { name, description, essence, audience, stage, canvas } = draft;
  const idea = { name, description, essence, audience, stage, canvas };
  return jsonOrThrow(
    await fetch(`${API_BASE}/ideas/assistant`, jsonRequest(token, "POST", { action, idea, question })),
  );
}

export async function fetchOpenGrantCalls(): Promise<GrantCall[]> {
  return jsonOrThrow(await fetch(`${API_BASE}/grant-calls`, { cache: "no-store" }));
}

export async function fetchMyGrantApplication(
  token: string,
  callId: string,
): Promise<GrantApplication | null> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/grant-calls/${callId}/application`, {
      headers: authHeaders(token),
      cache: "no-store",
    }),
  );
}

export async function saveGrantApplication(
  token: string,
  callId: string,
  payload: { idea_id: string | null; answers: Record<string, string>; submit: boolean },
): Promise<GrantApplication> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/grant-calls/${callId}/application`, jsonRequest(token, "PUT", payload)),
  );
}

export async function fetchAdminGrantCalls(token: string): Promise<GrantCall[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/grant-calls`, { headers: authHeaders(token), cache: "no-store" }),
  );
}

export async function saveGrantCall(
  token: string,
  payload: GrantCallInput,
  callId?: string | null,
): Promise<GrantCall> {
  const base = `${API_BASE}/admin/grant-calls`;
  return jsonOrThrow(
    await fetch(
      callId ? `${base}/${callId}` : base,
      jsonRequest(token, callId ? "PATCH" : "POST", payload),
    ),
  );
}

export async function deleteGrantCall(token: string, callId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/grant-calls/${callId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export async function fetchGrantApplications(
  token: string,
  callId: string,
): Promise<GrantApplication[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/grant-calls/${callId}/applications`, {
      headers: authHeaders(token),
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

async function deleteOrThrow(token: string, url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE", headers: authHeaders(token) });
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

export async function fetchMyTesting(token: string): Promise<MyTesting> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/testing/mine`, { headers: authHeaders(token), cache: "no-store" }),
  );
}

export async function createTesterSignup(
  token: string,
  target: TestTarget,
  motivation: string,
): Promise<TesterSignup> {
  return jsonOrThrow(
    await fetch(`${solutionUrl(target)}/signups`, jsonRequest(token, "POST", { motivation })),
  );
}

export async function withdrawTesterSignup(token: string, signupId: string): Promise<void> {
  return deleteOrThrow(token, `${API_BASE}/testing/signups/${signupId}`);
}

export async function saveSolutionReview(
  token: string,
  target: TestTarget,
  payload: SolutionReviewInput,
): Promise<SolutionReview> {
  return jsonOrThrow(await fetch(`${solutionUrl(target)}/review`, jsonRequest(token, "PUT", payload)));
}

export async function deleteSolutionReview(token: string, target: TestTarget): Promise<void> {
  return deleteOrThrow(token, `${solutionUrl(target)}/review`);
}

export async function fetchAdminTesterSignups(token: string): Promise<AdminTesterSignup[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/testing/signups`, {
      headers: authHeaders(token),
      cache: "no-store",
    }),
  );
}

export async function setTesterSignupStatus(
  token: string,
  signupId: string,
  status: IdeaStatus,
): Promise<AdminTesterSignup> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/admin/testing/signups/${signupId}`,
      jsonRequest(token, "PATCH", { status }),
    ),
  );
}

export async function fetchAdminSolutionReviews(token: string): Promise<AdminSolutionReview[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/testing/reviews`, {
      headers: authHeaders(token),
      cache: "no-store",
    }),
  );
}

export async function deleteAdminSolutionReview(token: string, reviewId: string): Promise<void> {
  return deleteOrThrow(token, `${API_BASE}/admin/testing/reviews/${reviewId}`);
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
export async function fetchListings(token: string | null): Promise<Listing[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/partnerships`, {
      headers: token ? authHeaders(token) : undefined,
      cache: "no-store",
    }),
  );
}

export async function createListing(token: string, payload: ListingInput): Promise<Listing> {
  return jsonOrThrow(await fetch(`${API_BASE}/partnerships`, jsonRequest(token, "POST", payload)));
}

export async function deleteListing(token: string, listingId: string): Promise<void> {
  return deleteOrThrow(token, `${API_BASE}/partnerships/${listingId}`);
}

export async function contactListingAuthor(
  token: string,
  listingId: string,
  body: string,
): Promise<ConversationDetail> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/partnerships/${listingId}/contact`,
      jsonRequest(token, "POST", { body }),
    ),
  );
}

export async function fetchConversations(token: string): Promise<Conversation[]> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/conversations`, { headers: authHeaders(token), cache: "no-store" }),
  );
}

export async function createConversation(
  token: string,
  payload: ConversationInput,
): Promise<ConversationDetail> {
  return jsonOrThrow(await fetch(`${API_BASE}/conversations`, jsonRequest(token, "POST", payload)));
}

export async function fetchConversation(
  token: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }
  return res.json() as Promise<ConversationDetail>;
}

export async function setConversationStatus(
  token: string,
  conversationId: string,
  status: ConversationStatus,
): Promise<ConversationDetail> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/conversations/${conversationId}`,
      jsonRequest(token, "PATCH", { status }),
    ),
  );
}

export async function sendThreadMessage(
  token: string,
  conversationId: string,
  body: string,
): Promise<ConversationDetail> {
  return jsonOrThrow(
    await fetch(
      `${API_BASE}/conversations/${conversationId}/messages`,
      jsonRequest(token, "POST", { body }),
    ),
  );
}

export async function updateMyProfile(token: string, payload: ProfileInput): Promise<User> {
  return jsonOrThrow(await fetch(`${API_BASE}/users/me`, jsonRequest(token, "PATCH", payload)));
}

export async function changeMyPassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/users/me/password`,
    jsonRequest(token, "POST", {
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
  token: string,
  userId: string,
  role: "user" | "specialist",
): Promise<User> {
  return jsonOrThrow(
    await fetch(`${API_BASE}/admin/users/${userId}`, jsonRequest(token, "PATCH", { role })),
  );
}
