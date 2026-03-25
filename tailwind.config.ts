import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans CJK SC',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SFMono-Regular',
          'Cascadia Mono',
          'Roboto Mono',
          'Source Code Pro',
          'Consolas',
          'Menlo',
          'Monaco',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
