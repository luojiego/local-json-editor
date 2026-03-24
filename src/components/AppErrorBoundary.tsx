import { Component, type ErrorInfo, type ReactNode } from 'react';

import { FatalErrorScreen } from './FatalErrorScreen';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = {
    error: null,
    componentStack: '',
  };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      error,
      componentStack: '',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React 渲染异常:', error, errorInfo);
    this.setState({
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  public render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) {
      return this.props.children;
    }

    const details = formatErrorDetails(error, componentStack);

    return (
      <FatalErrorScreen
        title="应用渲染失败"
        message={error.message || '渲染期间发生未知错误'}
        details={details}
      />
    );
  }
}

function formatErrorDetails(error: Error, componentStack: string): string {
  const lines = [
    `错误类型: ${error.name || 'Error'}`,
    `错误信息: ${error.message || '未知错误'}`,
  ];

  if (error.stack) {
    lines.push(`调用栈:\n${error.stack}`);
  }

  if (componentStack.trim()) {
    lines.push(`组件栈:\n${componentStack}`);
  }

  return lines.join('\n\n');
}
