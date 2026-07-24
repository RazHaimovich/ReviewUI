import clsx from 'clsx';
import { FileIcon, Trash2Icon, XIcon } from 'lucide-react';
import { CommentCard } from './Comment.jsx';

function Snippet({ lines, selStart, selCount }) {
  return (
    <div className="max-h-52 overflow-auto border-b border-line bg-bg font-mono text-[11px] leading-relaxed">
      {lines.map((l, i) => {
        const selected = selStart != null && i >= selStart && i < selStart + selCount;
        const sign = l.content[0];
        return (
          <div key={i} className={clsx('flex', selected && 'bg-mark')}>
            <span className="w-9 shrink-0 select-none border-r border-line px-1.5 text-right text-faint tnum">
              {l.num ?? ''}
            </span>
            <span
              className={clsx(
                'flex-1 whitespace-pre px-2',
                sign === '+' && 'text-add',
                sign === '-' && 'text-del',
                sign === ' ' && 'text-muted'
              )}
            >
              {l.content || ' '}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CommentsModal({ comments, onUpdate, onDelete, onReset, onClose }) {
  const included = comments.filter((c) => c.included !== false).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            Comments
            <span className="ml-2 font-normal text-muted tnum">
              {comments.length} total · {included} in prompt
            </span>
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel2 hover:text-ink"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="space-y-3 overflow-y-auto bg-bg p-4">
          {comments.length === 0 && <p className="py-8 text-center text-sm text-muted">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-lg border border-line bg-panel">
              <div className="flex items-center gap-1.5 border-b border-line bg-panel2 px-3 py-1.5 font-mono text-[11px] text-muted">
                <FileIcon className="size-3 shrink-0" />
                <span className="truncate">{c.filePath}</span>
              </div>
              {c.lines ? (
                <Snippet lines={c.lines} selStart={c.selStart} selCount={c.selCount} />
              ) : (
                c.snippet && (
                  <pre className="max-h-52 overflow-auto border-b border-line bg-bg px-3 py-2 font-mono text-[11px] text-muted">
                    {c.snippet}
                  </pre>
                )
              )}
              <CommentCard comment={c} onUpdate={onUpdate} onDelete={onDelete} />
            </div>
          ))}
        </div>

        {comments.length > 0 && (
          <footer className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-md px-3 py-1 text-sm text-del hover:bg-del/10"
            >
              <Trash2Icon className="size-3.5" />
              Clear all
            </button>
            <span className="font-mono text-[11px] text-faint">Excluded comments are skipped in the prompt.</span>
          </footer>
        )}
      </div>
    </div>
  );
}
