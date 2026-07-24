import clsx from 'clsx';
import { FileIcon, XIcon } from 'lucide-react';
import { CommentCard } from './Comment.jsx';

function Snippet({ text }) {
  return (
    <pre className="max-h-40 overflow-auto border-b border-line bg-bg px-3 py-2 font-mono text-[11px] leading-relaxed">
      {text.split('\n').map((line, i) => (
        <div
          key={i}
          className={clsx(
            line.startsWith('+') && 'text-add',
            line.startsWith('-') && 'text-del',
            !line.startsWith('+') && !line.startsWith('-') && 'text-muted'
          )}
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}

export default function CommentsModal({ comments, onUpdate, onDelete, onClose }) {
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

        <div className="space-y-2.5 overflow-y-auto bg-bg p-4">
          {comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">No comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-lg border border-line">
              <div className="flex items-center gap-1.5 border-b border-line bg-panel2 px-3 py-1.5 font-mono text-[11px] text-muted">
                <FileIcon className="size-3 shrink-0" />
                <span className="truncate">{c.filePath}</span>
              </div>
              {c.snippet && <Snippet text={c.snippet} />}
              <CommentCard comment={c} onUpdate={onUpdate} onDelete={onDelete} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
