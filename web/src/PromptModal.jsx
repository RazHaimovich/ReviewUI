import { useState } from 'react';

export default function PromptModal({ text, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-300 px-4 py-2">
          <h2 className="font-semibold">Claude Code prompt</h2>
          <div className="flex gap-2 text-sm">
            <button
              onClick={copy}
              className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-800"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={onClose} className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100">
              Close
            </button>
          </div>
        </header>
        <pre className="overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">{text}</pre>
        <footer className="border-t border-gray-300 px-4 py-2 text-xs text-gray-500">
          Also printed to the terminal running ReviewUI.
        </footer>
      </div>
    </div>
  );
}
