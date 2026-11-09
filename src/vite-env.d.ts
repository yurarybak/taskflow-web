/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the TaskFlow REST API, e.g. http://localhost:3000. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
