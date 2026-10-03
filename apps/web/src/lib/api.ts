/** Browser talks to Next.js BFF at /api/*; the BFF proxies to the internal FastAPI service. */
const API_BASE = "/api";

export type User = {
  id: number;
  email: string;
  full_name: string | null;
  role: "user" | "admin" | string;
  is_active: boolean;
  created_at: string;
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
  id: number;
  name: string;
  territory: string;
  competencies: string;
  created_at: string;
};

export type Project = {
  id: number;
  unit_id: number;
  unit_name: string | null;
  name: string;
  description: string;
  created_at: string;
};

export type ReportKind = "problem" | "wydarzenie" | "informacja";
export type ReportStatus = "nowe" | "w_toku" | "zakonczone";

export type Report = {
  id: number;
  author_id: number;
  unit_id: number;
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

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(payload: {
  email: string;
  password: string;
  full_name?: string;
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

export async function loginUser(email: string, password: string): Promise<string> {
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

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
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

export async function deleteUnit(token: string, unitId: number): Promise<void> {
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
  unitId?: number,
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
  payload: { unit_id: number; name: string; description: string },
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
  projectId: number,
  payload: { unit_id?: number; name?: string; description?: string },
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

export async function deleteProject(token: string, projectId: number): Promise<void> {
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
  reportId: number,
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

export async function sendChatMessage(token: string, message: string): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { reply: string };
  return data.reply;
}
