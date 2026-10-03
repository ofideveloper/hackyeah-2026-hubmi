const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  full_name?: string;
}): Promise<User> {
  const res = await fetch(`${API_URL}/auth/register`, {
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

  const res = await fetch(`${API_URL}/auth/login`, {
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
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<User>;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_URL}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<AdminStats>;
}

export async function fetchAdminUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<User[]>;
}
