// Thin typed API client for the FastAPI backend.

// In local dev this is empty and requests hit "/api/..." (proxied by Vite to
// the backend). In production (Vercel) set VITE_API_BASE to the backend URL,
// e.g. https://edu-timetabelo-backend.onrender.com
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

const TOKEN_KEY = "tt_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export interface UserPublic {
  id: number;
  email: string;
  display_name: string;
}

export interface UserProgress {
  user: UserPublic;
  total: number;
  completed: number;
  pending: number;
  percent: number;
}

export interface Entry {
  id: number;
  title: string;
  description: string;
  entry_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  sprint_id: number | null;
  assignee_id: number | null;
  completed: boolean;
  status: string; // "pending", "completed", "cancelled"
  day_of_week: number;
  created_at: string;
  owner_id: number;
  creator_name: string;
  assignee_name: string | null;
}

export interface Sprint {
  id: number;
  kind: "weekly" | "monthly";
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface SprintProgress {
  sprint: Sprint;
  total: number;
  completed: number;
  percent: number;
}

export interface DayProgress {
  date: string;
  day_of_week: number;
  is_weekend: boolean;
  total: number;
  completed: number;
  percent: number;
}

export interface SprintDetail {
  sprint: Sprint;
  total: number;
  completed: number;
  percent: number;
  days: DayProgress[];
}

export interface DayWindow {
  is_weekend: boolean;
  start: string;
  end: string;
}

export interface Rules {
  weekday: DayWindow;
  weekend: DayWindow;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const api = {
  // ---- Auth ----
  async register(
    email: string,
    password: string,
    display_name: string,
    invite_code: string
  ) {
    return request<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name, invite_code }),
    });
  },

  async login(email: string, password: string) {
    // OAuth2 password flow expects form-encoded username/password.
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);
    return request<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  },

  async me() {
    return request<{
      id: number;
      email: string;
      display_name: string;
      created_at: string;
    }>("/api/auth/me");
  },

  // ---- Users ----
  async listUsers() {
    return request<UserPublic[]>("/api/users");
  },

  async usersProgress(params: { start?: string; end?: string } = {}) {
    const q = new URLSearchParams();
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    const qs = q.toString();
    return request<UserProgress[]>(`/api/users/progress${qs ? `?${qs}` : ""}`);
  },

  // ---- Rules ----
  async rules() {
    return request<Rules>("/api/rules");
  },

  // ---- Entries ----
  async listEntries(
    params: {
      start?: string;
      end?: string;
      sprint_id?: number;
      assignee_id?: number;
    } = {}
  ) {
    const q = new URLSearchParams();
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    if (params.sprint_id != null) q.set("sprint_id", String(params.sprint_id));
    if (params.assignee_id != null) q.set("assignee_id", String(params.assignee_id));
    const qs = q.toString();
    return request<Entry[]>(`/api/entries${qs ? `?${qs}` : ""}`);
  },

  async createEntry(payload: {
    title: string;
    description: string;
    entry_date: string;
    start_time: string;
    end_time: string;
    sprint_id: number | null;
    assignee_id: number | null;
  }) {
    return request<Entry>("/api/entries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateEntry(id: number, payload: Partial<Entry>) {
    return request<Entry>(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async deleteEntry(id: number) {
    return request<void>(`/api/entries/${id}`, { method: "DELETE" });
  },

  async copyDay(source_date: string, target_dates: string[]) {
    return request<Entry[]>("/api/entries/copy", {
      method: "POST",
      body: JSON.stringify({ source_date, target_dates }),
    });
  },

  async checkOverdueTasksEmailReminders() {
    return request<{ message: string; tasks_checked: number; emails_sent: number }>(
      "/api/entries/check-overdue",
      { method: "POST" }
    );
  },

  // ---- Sprints ----
  async listSprints(kind?: "weekly" | "monthly") {
    const qs = kind ? `?kind=${kind}` : "";
    return request<Sprint[]>(`/api/sprints${qs}`);
  },

  async createSprintAuto(payload: {
    kind: "weekly" | "monthly";
    title: string;
    description: string;
    anchor_date: string;
  }) {
    return request<Sprint>("/api/sprints/auto", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async sprintProgress(id: number) {
    return request<SprintProgress>(`/api/sprints/${id}/progress`);
  },

  async sprintBreakdown(id: number) {
    return request<SprintDetail>(`/api/sprints/${id}/breakdown`);
  },

  async deleteSprint(id: number) {
    return request<void>(`/api/sprints/${id}`, { method: "DELETE" });
  },
};

export { ApiError };
