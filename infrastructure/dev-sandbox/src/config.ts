/**
 * Sandbox config from env or defaults for local dev.
 * Set VITE_* in .env or in the UI (Phase 7/8).
 */
export function getConfig(): {
  registryUrl: string;
  provisionerUrl: string;
  platformBaseUrl: string;
} {
  return {
    registryUrl:
      import.meta.env.VITE_REGISTRY_URL ?? "http://localhost:3001",
    provisionerUrl:
      import.meta.env.VITE_PROVISIONER_URL ?? "http://localhost:4321",
    platformBaseUrl:
      import.meta.env.VITE_PLATFORM_BASE_URL ?? "http://localhost:9888",
  };
}
