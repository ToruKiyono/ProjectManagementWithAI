/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly AI_BASE_URL?: string;
  readonly AI_API_KEY?: string;
  readonly AI_MODEL?: string;
  readonly AI_PROVIDER_NAME?: string;
  readonly AI_TIMEOUT_MS?: string;
  readonly VITE_AI_BASE_URL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_AI_MODEL?: string;
  readonly VITE_AI_PROVIDER_NAME?: string;
  readonly VITE_AI_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
