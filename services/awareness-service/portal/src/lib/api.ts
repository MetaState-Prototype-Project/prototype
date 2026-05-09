import { env } from "$env/dynamic/public";

/** Base URL of the AaaS API. Falls back to the default local dev port. */
export const API_BASE =
    env.PUBLIC_AWARENESS_API_URL ?? "http://localhost:4100";

export interface ApiError {
    error: string;
}

/** Thin fetch wrapper that attaches the bearer token and parses JSON. */
export async function api<T = unknown>(
    path: string,
    options: {
        method?: string;
        body?: unknown;
        token?: string | null;
    } = {},
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        throw new Error((data as ApiError).error ?? `request failed (${res.status})`);
    }
    return data as T;
}
