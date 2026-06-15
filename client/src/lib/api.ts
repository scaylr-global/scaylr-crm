const TOKEN_KEY = 'scaylr_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    if (!path.startsWith('/auth/login')) {
      window.location.href = '/login';
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body ?? {}),
  put: <T = any>(path: string, body?: any) => request<T>('PUT', path, body ?? {}),
  patch: <T = any>(path: string, body?: any) => request<T>('PATCH', path, body ?? {}),
  del: <T = any>(path: string) => request<T>('DELETE', path),
};

// ---- Types ----
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  avatar_initials: string;
  avatar_color: string;
  created_at?: string;
}

export interface Lead {
  id: number;
  name: string;
  role_title: string | null;
  company: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  industry: string;
  status: string;
  assigned_to: number | null;
  assignee?: { id: number; name: string; avatar_initials: string; avatar_color: string } | null;
  created_at: string;
  last_contact_at: string | null;
  notes: string | null;
}

export interface CallLog {
  id: number;
  lead_id: number;
  logged_by: number;
  outcome: string;
  duration_seconds: number;
  notes: string | null;
  created_at: string;
  lead_name?: string;
  lead_company?: string;
  logger_name?: string;
  logger?: { name: string };
}

export interface FollowUp {
  id: number;
  lead_id: number;
  assigned_to: number | null;
  scheduled_at: string;
  note: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  lead_name?: string;
  lead_company?: string;
  lead_status?: string;
  assignee_name?: string;
}

export interface TargetRow {
  id: number;
  name: string;
  role: string;
  avatar_initials: string;
  avatar_color: string;
  daily_target: number;
  calls_today: number;
}

export interface Activity {
  id: number;
  user_id: number | null;
  action_type: string;
  description: string;
  lead_id: number | null;
  created_at: string;
  user_name?: string;
  avatar_initials?: string;
  avatar_color?: string;
  lead_name?: string;
}
