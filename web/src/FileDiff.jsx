import { useState } from 'react';
import { Diff, Hunk, getChangeKey } from 'react-diff-view';

export function filePath(file) {
  return file.type === 'delete' ? file.oldPath : file.newPath;
}

function diffLine(change) {
  return (change.isInsert ? '+' : change.isDelete ? '-' : ' ') + change.content;
}

function snippetFor(hunk, change) {
  const index = hunk.changes.indexOf(change);
  const from = Math.max(0, index - 3);
  return hunk.changes.slice(from, index + 4).map(diffLine).join('\n');
}

function lineOf(change) {
  return change.type === 'normal' ? change.newLineNumber : change.lineNumber;
}

function CommentForm({ onSave, onCancel }) {
  const [body, setBody] = useState('');
  return (
    <div className="bg-blue-50 p-2 font-sans">
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment…"
        className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
      />
      <div className="mt-1 flex justify-end gap-2 text-sm">
        <button onClick={onCancel} className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100">
          Cancel
        </button>
        <button
          disabled={!body.trim()}
          onClick={() => onSave(body.trim())}
          className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-800 disabled:opacity-40"
        >
          Add comment
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment, onDelete }) {
  return (
    <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 font-sans text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap">{comment.body}</p>
        <button
          title="Delete comment"
          onClick={() => onDelete(comment.id)}
          className="rounded px-1 text-gray-400 hover:bg-amber-100 hover:text-red-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function FileDiff({ file, comments, onCreate, onDelete }) {
  const [draft, setDraft] = useState(null); // {changeKey, change, hunk}
  const path = filePath(file);

  const byKey = {};
  for (const c of comments) (byKey[c.changeKey] ??= []).push(c);
  if (draft) byKey[draft.changeKey] ??= [];

  const widgets = Object.fromEntries(
    Object.entries(byKey).map(([key, list]) => [
      key,
      <div className="border-b border-amber-200">
        {list.map((c) => (
          <CommentCard key={c.id} comment={c} onDelete={onDelete} />
        ))}
        {draft?.changeKey === key && (
          <CommentForm
            onCancel={() => setDraft(null)}
            onSave={(body) => {
              const { change, hunk } = draft;
              onCreate({
                filePath: path,
                changeKey: key,
                side: change.type === 'delete' ? 'old' : 'new',
                startLine: lineOf(change),
                endLine: lineOf(change),
                snippet: snippetFor(hunk, change),
                body,
              });
              setDraft(null);
            }}
          />
        )}
      </div>,
    ])
  );

  // ponytail: v3.3 Hunk ignores its own event props — events must go on Diff
  const gutterEvents = {
    onClick: ({ change }) => {
      const hunk = file.hunks.find((h) => h.changes.includes(change));
      if (hunk) setDraft({ changeKey: getChangeKey(change), change, hunk });
    },
  };

  return (
    <section id={path} className="mb-4 overflow-hidden rounded-md border border-gray-300">
      <header className="flex items-center gap-2 border-b border-gray-300 bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700">
        {file.type === 'rename' ? `${file.oldPath} → ${file.newPath}` : path}
        {file.type === 'add' && <span className="text-green-700">added</span>}
        {file.type === 'delete' && <span className="text-red-700">deleted</span>}
        {comments.length > 0 && (
          <span className="rounded-full bg-amber-200 px-2 text-[10px] font-sans">{comments.length}</span>
        )}
      </header>
      <Diff viewType="unified" diffType={file.type} hunks={file.hunks} widgets={widgets} gutterEvents={gutterEvents}>
        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    </section>
  );
}
