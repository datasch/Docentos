/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_TAGLINE?: string;
  readonly VITE_APP_LOGO_INITIAL?: string;
  readonly VITE_APP_LOGO_URL?: string;
  readonly VITE_POWERED_BY_LINK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
