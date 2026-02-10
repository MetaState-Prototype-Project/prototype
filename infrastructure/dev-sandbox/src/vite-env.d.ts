/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REGISTRY_URL: string;
  readonly VITE_PROVISIONER_URL: string;
  readonly VITE_PLATFORM_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
