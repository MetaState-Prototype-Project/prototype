export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('group_charter_auth_token');
  }
  return false;
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('group_charter_auth_token');
  }
  return null;
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('group_charter_auth_token', token);
  }
}

export function removeAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('group_charter_auth_token');
  }
}

export function setAuthId(id: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ownerId', id);
  }
}

export function getAuthId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ownerId');
  }
  return null;
}

export function removeAuthId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ownerId');
  }
}