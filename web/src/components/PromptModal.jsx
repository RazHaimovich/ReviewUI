import { useState } from 'react';
import { CheckIcon, CopyIcon, TerminalIcon, XIcon } from 'lucide-react';

export default function PromptModal({ text, summary, onSummaryChange, onRegenerate, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent">
              <TerminalIcon className="size-3.5" />
            </span>
            <h2 className="text-sm font-semibold">Prompt for Claude Code</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent hover:bg-accent-hover"
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel2 hover:text-ink"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </header>
        <div className="border-b border-line p-3">
          <textarea
            rows={2}
            value={summary}
            onChange={(e) => onSummaryChange(e.target.value)}
            onBlur={onRegenerate}
            placeholder="Overall summary (optional) — applies to the whole review, e.g. “also add tests”"
            className="w-full resize-y rounded-md border border-line-strong bg-bg p-2 text-sm text-ink placeholder:text-faint"
          />
        </div>
        <pre className="overflow-auto whitespace-pre-wrap bg-bg p-4 font-mono text-xs leading-relaxed text-ink">
          {text}
        </pre>
        <footer className="flex items-center gap-1.5 border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
          <TerminalIcon className="size-3" />
          Also printed to the terminal running ReviewUI.
        </footer>
      </div>
    </div>
  );
}
