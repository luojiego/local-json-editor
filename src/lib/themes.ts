import type { Monaco } from '@monaco-editor/react';

export interface AppTheme {
  id: string;
  label: string;
  monacoThemeId: string;
  isDark: boolean;
  cssVars: Record<string, string>;
  monacoBase: 'vs' | 'vs-dark';
  monacoColors: Record<string, string>;
  monacoRules: Array<{ token: string; foreground: string; fontStyle?: string }>;
}

export const THEME_LIST: AppTheme[] = [
  {
    id: 'github-light',
    label: 'GitHub Light',
    monacoThemeId: 'json-editor-github-light',
    isDark: false,
    cssVars: {
      '--bg-base': '#f4f7fb',
      '--bg-sidebar': '#ffffff',
      '--bg-toolbar': '#ffffff',
      '--bg-editor': '#fdfefe',
      '--bg-status': '#ffffff',
      '--text-main': '#0f172a',
      '--text-muted': '#64748b',
      '--accent': '#0ea5e9',
      '--accent-strong': '#0284c7',
      '--border': '#dbe3ef',
      '--success': '#16a34a',
      '--danger': '#dc2626',
      '--warning': '#ea580c',
      '--shadow': '0 10px 28px rgba(15, 23, 42, 0.08)',
    },
    monacoBase: 'vs',
    monacoColors: {
      'editor.background': '#FDFEFE',
      'editorLineNumber.foreground': '#90A4B8',
      'editorCursor.foreground': '#0369A1',
      'editor.selectionBackground': '#BAE6FD80',
      'editor.inactiveSelectionBackground': '#E2E8F066',
    },
    monacoRules: [
      { token: 'string', foreground: '0F766E' },
      { token: 'number', foreground: '0C4A6E' },
      { token: 'keyword', foreground: '7C3AED' },
      { token: 'delimiter', foreground: '475569' },
    ],
  },
  {
    id: 'vscode-dark',
    label: 'VS Code Dark',
    monacoThemeId: 'json-editor-vscode-dark',
    isDark: true,
    cssVars: {
      '--bg-base': '#0b1220',
      '--bg-sidebar': '#111827',
      '--bg-toolbar': '#111827',
      '--bg-editor': '#0f172a',
      '--bg-status': '#111827',
      '--text-main': '#e5eef9',
      '--text-muted': '#93aac7',
      '--accent': '#38bdf8',
      '--accent-strong': '#0ea5e9',
      '--border': '#1f324d',
      '--success': '#4ade80',
      '--danger': '#f87171',
      '--warning': '#fb923c',
      '--shadow': '0 14px 34px rgba(2, 6, 23, 0.45)',
    },
    monacoBase: 'vs-dark',
    monacoColors: {
      'editor.background': '#0F172A',
      'editorLineNumber.foreground': '#4F6583',
      'editorCursor.foreground': '#38BDF8',
      'editor.selectionBackground': '#0EA5E955',
      'editor.inactiveSelectionBackground': '#1E293B88',
    },
    monacoRules: [
      { token: 'string', foreground: '4ADE80' },
      { token: 'number', foreground: 'FACC15' },
      { token: 'keyword', foreground: 'C084FC' },
      { token: 'delimiter', foreground: 'CBD5E1' },
    ],
  },
  {
    id: 'monokai',
    label: 'Monokai',
    monacoThemeId: 'json-editor-monokai',
    isDark: true,
    cssVars: {
      '--bg-base': '#1d1f1a',
      '--bg-sidebar': '#272822',
      '--bg-toolbar': '#272822',
      '--bg-editor': '#272822',
      '--bg-status': '#272822',
      '--text-main': '#f8f8f2',
      '--text-muted': '#b4b49f',
      '--accent': '#f4bf75',
      '--accent-strong': '#f5a623',
      '--border': '#3f4038',
      '--success': '#a6e22e',
      '--danger': '#f92672',
      '--warning': '#fd971f',
      '--shadow': '0 16px 32px rgba(10, 10, 10, 0.45)',
    },
    monacoBase: 'vs-dark',
    monacoColors: {
      'editor.background': '#272822',
      'editorLineNumber.foreground': '#75715E',
      'editorCursor.foreground': '#F8F8F0',
      'editor.selectionBackground': '#49483EAA',
      'editor.inactiveSelectionBackground': '#3A3A3288',
    },
    monacoRules: [
      { token: 'string', foreground: 'E6DB74' },
      { token: 'number', foreground: 'AE81FF' },
      { token: 'keyword', foreground: 'F92672' },
      { token: 'delimiter', foreground: 'F8F8F2' },
    ],
  },
  {
    id: 'dracula',
    label: 'Dracula',
    monacoThemeId: 'json-editor-dracula',
    isDark: true,
    cssVars: {
      '--bg-base': '#23253a',
      '--bg-sidebar': '#282a36',
      '--bg-toolbar': '#282a36',
      '--bg-editor': '#282a36',
      '--bg-status': '#282a36',
      '--text-main': '#f8f8f2',
      '--text-muted': '#bdc1de',
      '--accent': '#8be9fd',
      '--accent-strong': '#50fa7b',
      '--border': '#3a3d59',
      '--success': '#50fa7b',
      '--danger': '#ff5555',
      '--warning': '#ffb86c',
      '--shadow': '0 16px 32px rgba(17, 19, 29, 0.5)',
    },
    monacoBase: 'vs-dark',
    monacoColors: {
      'editor.background': '#282A36',
      'editorLineNumber.foreground': '#6272A4',
      'editorCursor.foreground': '#F8F8F2',
      'editor.selectionBackground': '#44475A99',
      'editor.inactiveSelectionBackground': '#44475A66',
    },
    monacoRules: [
      { token: 'string', foreground: 'F1FA8C' },
      { token: 'number', foreground: 'BD93F9' },
      { token: 'keyword', foreground: 'FF79C6' },
      { token: 'delimiter', foreground: 'F8F8F2' },
    ],
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    monacoThemeId: 'json-editor-solarized-light',
    isDark: false,
    cssVars: {
      '--bg-base': '#f9f3df',
      '--bg-sidebar': '#fdf6e3',
      '--bg-toolbar': '#fdf6e3',
      '--bg-editor': '#fdf6e3',
      '--bg-status': '#fdf6e3',
      '--text-main': '#073642',
      '--text-muted': '#657b83',
      '--accent': '#268bd2',
      '--accent-strong': '#2aa198',
      '--border': '#d9cfae',
      '--success': '#859900',
      '--danger': '#dc322f',
      '--warning': '#cb4b16',
      '--shadow': '0 12px 30px rgba(88, 110, 117, 0.18)',
    },
    monacoBase: 'vs',
    monacoColors: {
      'editor.background': '#FDF6E3',
      'editorLineNumber.foreground': '#93A1A1',
      'editorCursor.foreground': '#586E75',
      'editor.selectionBackground': '#EEE8D5CC',
      'editor.inactiveSelectionBackground': '#EEE8D58A',
    },
    monacoRules: [
      { token: 'string', foreground: '2AA198' },
      { token: 'number', foreground: 'D33682' },
      { token: 'keyword', foreground: '859900' },
      { token: 'delimiter', foreground: '586E75' },
    ],
  },
  {
    id: 'night-owl',
    label: 'Night Owl',
    monacoThemeId: 'json-editor-night-owl',
    isDark: true,
    cssVars: {
      '--bg-base': '#061524',
      '--bg-sidebar': '#011627',
      '--bg-toolbar': '#011627',
      '--bg-editor': '#011627',
      '--bg-status': '#011627',
      '--text-main': '#d6deeb',
      '--text-muted': '#8fa3c4',
      '--accent': '#7fdbca',
      '--accent-strong': '#21c7a8',
      '--border': '#173b57',
      '--success': '#addb67',
      '--danger': '#ef5350',
      '--warning': '#f78c6c',
      '--shadow': '0 16px 34px rgba(1, 8, 15, 0.52)',
    },
    monacoBase: 'vs-dark',
    monacoColors: {
      'editor.background': '#011627',
      'editorLineNumber.foreground': '#375A7F',
      'editorCursor.foreground': '#80A4C2',
      'editor.selectionBackground': '#1D3B53CC',
      'editor.inactiveSelectionBackground': '#1D3B5390',
    },
    monacoRules: [
      { token: 'string', foreground: 'ECC48D' },
      { token: 'number', foreground: 'F78C6C' },
      { token: 'keyword', foreground: 'C792EA' },
      { token: 'delimiter', foreground: 'D6DEEB' },
    ],
  },
];

let monacoThemesDefined = false;

export function getThemeById(themeId: string): AppTheme {
  return THEME_LIST.find((theme) => theme.id === themeId) ?? THEME_LIST[0];
}

export function applyThemeVariables(theme: AppTheme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.cssVars)) {
    root.style.setProperty(key, value);
  }
}

export function defineMonacoThemes(monaco: Monaco): void {
  if (monacoThemesDefined) {
    return;
  }

  for (const theme of THEME_LIST) {
    monaco.editor.defineTheme(theme.monacoThemeId, {
      base: theme.monacoBase,
      inherit: true,
      rules: theme.monacoRules,
      colors: theme.monacoColors,
    });
  }

  monacoThemesDefined = true;
}
