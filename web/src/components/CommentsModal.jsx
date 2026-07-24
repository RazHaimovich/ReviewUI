import { XIcon } from 'lucide-react';
import { CommentCard } from './Comment.jsx';

export default function CommentsModal({ comments, onUpdate, onDelete, onClose }) {
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
            Comments <span className="text-muted tnum">({comments.length})</span>
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel2 hover:text-ink"
          >
            <XIcon className="size-4" />
          </button>
        </header>
        <div className="overflow-y-auto">
          {comments.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">No comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="border-b border-line last:border-b-0">
              <div className="px-3 pt-2 font-mono text-[11px] text-muted">{c.filePath}</div>
              <CommentCard comment={c} onUpdate={onUpdate} onDelete={onDelete} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
