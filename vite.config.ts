import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = resolveBasePath(process.env.VITE_BASE);
const allowedHosts = resolveAllowedHosts(process.env.VITE_ALLOWED_HOSTS);

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'monaco-vendor': ['@monaco-editor/react', 'monaco-editor'],
        },
      },
    },
  },
  server: {
    port: 8010,
    strictPort: true,
    allowedHosts,
  },
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

function resolveAllowedHosts(rawHosts: string | undefined): string[] {
  const hosts = new Set<string>(['inner-json-editor.huoyfish.com']);

  const extraHosts = rawHosts
    ?.split(',')
    .map((host) => host.trim())
    .filter(Boolean) ?? [];

  for (const host of extraHosts) {
    hosts.add(host);
  }

  return [...hosts];
}
