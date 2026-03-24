import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = resolveBasePath(process.env.VITE_BASE);

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
