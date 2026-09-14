/// <reference types="astro/client" />

interface ImportMetaEnv {
  // See .env.example. Unset means "no leaderboard", which the UI handles.
  readonly PUBLIC_SURREAL_URL?: string;
  readonly PUBLIC_SURREAL_NS?: string;
  readonly PUBLIC_SURREAL_DB?: string;
  readonly PUBLIC_SURREAL_ACCESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
