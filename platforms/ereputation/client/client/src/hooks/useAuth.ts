import { useAuth as useAuthContext } from "../lib/auth-context";

export function useAuth() {
  return useAuthContext();
}