import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { FatalErrorScreen } from './components/FatalErrorScreen';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('找不到根节点 #root');
}

const root = ReactDOM.createRoot(rootElement);
let fatalScreenVisible = false;

installGlobalFatalHandlers(showFatalErrorScreen);

try {
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  showFatalErrorScreen({
    title: '应用启动失败',
    message: normalizeErrorMessage(error),
    details: formatUnknownErrorDetails(error),
  });
}

function installGlobalFatalHandlers(onFatal: (payload: FatalPayload) => void): void {
  window.addEventListener('error', (event) => {
    const details = formatUnknownErrorDetails(event.error, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });

    onFatal({
      title: '应用运行异常',
      message: event.message || normalizeErrorMessage(event.error),
      details,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    onFatal({
      title: '未处理的异步异常',
      message: normalizeErrorMessage(event.reason),
      details: formatUnknownErrorDetails(event.reason),
    });
  });
}

interface FatalPayload {
  title: string;
  message: string;
  details: string;
}

function showFatalErrorScreen(payload: FatalPayload): void {
  if (fatalScreenVisible) {
    return;
  }

  fatalScreenVisible = true;
  root.render(
    <React.StrictMode>
      <FatalErrorScreen
        title={payload.title}
        message={payload.message}
        details={payload.details}
      />
    </React.StrictMode>,
  );
}

function normalizeErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || value.name || '未知错误';
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '未知错误对象';
    }
  }

  return '未知错误';
}

function formatUnknownErrorDetails(
  value: unknown,
  metadata?: {
    source?: string;
    line?: number;
    column?: number;
  },
): string {
  const lines: string[] = [];

  if (metadata?.source) {
    const lineInfo =
      typeof metadata.line === 'number' && typeof metadata.column === 'number'
        ? `:${metadata.line}:${metadata.column}`
        : '';
    lines.push(`来源: ${metadata.source}${lineInfo}`);
  }

  if (value instanceof Error) {
    lines.push(`错误类型: ${value.name || 'Error'}`);
    lines.push(`错误信息: ${value.message || '未知错误'}`);
    if (value.stack) {
      lines.push(`调用栈:\n${value.stack}`);
    }
    return lines.join('\n\n');
  }

  if (typeof value === 'string') {
    lines.push(`错误信息: ${value || '未知错误'}`);
    return lines.join('\n\n');
  }

  if (value && typeof value === 'object') {
    try {
      lines.push(`错误对象: ${JSON.stringify(value, null, 2)}`);
    } catch {
      lines.push('错误对象无法序列化');
    }
    return lines.join('\n\n');
  }

  lines.push('未知错误');
  return lines.join('\n\n');
}
