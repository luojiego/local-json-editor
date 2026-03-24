import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const tauriPlatform = process.env.TAURI_ENV_PLATFORM?.trim();
const isTauriBuild = Boolean(tauriPlatform);
const base = isTauriBuild ? './' : resolveBasePath(process.env.VITE_BASE);

export default defineConfig({
  plugins: [react()],
  base,
});

function resolveBasePath(rawBasePath: string | undefined): string {
  const trimmedBasePath = rawBasePath?.trim();
  if (!trimmedBasePath) {
    return '/';
  }

  const withLeadingSlash = trimmedBasePath.startsWith('/')
    ? trimmedBasePath
    : `/${trimmedBasePath}`;

  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}
