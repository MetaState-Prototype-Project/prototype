// From root .env (loaded in next.config)
const API_URL =
  process.env.NEXT_PUBLIC_CALENDAR_API_URL ?? "http://localhost:4001";
const TOKEN_KEY = "calendar-w3ds-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export interface CalendarEventApi {
  id: string;
  title: string;
  color: string;
  start: string;
  end: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const j = JSON.parse(body);
      message = j.message ?? j.error ?? body;
    } catch {
      // use body as message
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const calendarApi = {
  getOffer(): Promise<{ uri: string; sessionId: string }> {
    return request("/api/auth/offer");
  },

  login(body: {
    ename: string;
    session: string;
    signature: string;
    appVersion?: string;
  }): Promise<{ token: string }> {
    return request("/api/auth", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getEvents(): Promise<CalendarEventApi[]> {
    return request("/api/events");
  },

  createEvent(body: {
    title: string;
    color: string;
    start: string;
    end: string;
  }): Promise<CalendarEventApi> {
    return request("/api/events", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateEvent(
    id: string,
    body: Partial<{ title: string; color: string; start: string; end: string }>
  ): Promise<CalendarEventApi> {
    return request(`/api/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteEvent(id: string): Promise<void> {
    return request(`/api/events/${id}`, { method: "DELETE" });
  },
};

export function parseSessionFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.searchParams.get("session");
  } catch {
    return null;
  }
}
