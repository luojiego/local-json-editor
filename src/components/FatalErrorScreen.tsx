interface FatalErrorScreenProps {
  title: string;
  message: string;
  details?: string;
}

export function FatalErrorScreen({ title, message, details }: FatalErrorScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-base)] px-6 py-8 text-[var(--text-main)]">
      <div className="w-full max-w-3xl rounded-xl border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[var(--bg-toolbar)] p-6 shadow-[var(--shadow)]">
        <h1 className="text-xl font-semibold text-[var(--danger)]">{title}</h1>
        <p className="mt-3 text-sm text-[var(--text-main)]">{message}</p>
        {details ? (
          <pre className="mt-4 max-h-[45vh] overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-editor)] p-3 text-xs leading-6 text-[var(--text-main)]">
            {details}
          </pre>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            onClick={() => window.location.reload()}
          >
            重新加载应用
          </button>
          <p className="self-center text-xs text-[var(--text-muted)]">
            请截图本页内容并反馈给开发者，便于快速定位问题。
          </p>
        </div>
      </div>
    </div>
  );
}
