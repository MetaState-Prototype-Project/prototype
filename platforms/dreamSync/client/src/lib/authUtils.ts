export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export const setAuthToken = (token: string) => {
  localStorage.setItem("dreamsync_token", token);
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dreamsync_token");
};

export const removeAuthToken = () => {
  localStorage.removeItem("dreamsync_token");
};

export const setAuthId = (id: string) => {
  localStorage.setItem("dreamsync_user_id", id);
};

export const getAuthId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dreamsync_user_id");
};

export const removeAuthId = () => {
  localStorage.removeItem("dreamsync_user_id");
};

export const clearAuth = () => {
  removeAuthToken();
  removeAuthId();
};