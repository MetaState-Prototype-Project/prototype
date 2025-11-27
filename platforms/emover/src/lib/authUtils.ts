export function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("emover_token");
}

export function setAuthToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("emover_token", token);
}

export function getAuthId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("emover_user_id");
}

export function setAuthId(userId: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("emover_user_id", userId);
}

export function clearAuth(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("emover_token");
    localStorage.removeItem("emover_user_id");
}

