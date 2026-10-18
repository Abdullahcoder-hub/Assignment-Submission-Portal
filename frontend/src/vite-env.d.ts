/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BACKEND_URLS?: string;
  readonly VITE_BACKEND_POOL_ID?: string;
  readonly VITE_API_COMPATIBILITY_VERSION?: string;
  readonly VITE_CLIENT_EXPORT_MAX_SIZE_MB?: string;
  readonly VITE_CLIENT_EXPORT_MAX_FILES?: string;
  readonly VITE_CLIENT_EXPORT_MAX_PDF_PAGES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
