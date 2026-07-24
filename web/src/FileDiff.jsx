import { useState } from 'react';
import { Diff, Hunk, getChangeKey } from 'react-diff-view';

export function filePath(file) {
  return file.type === 'delete' ? file.oldPath : file.newPath;
}

function diffLine(change) {
  return (change.isInsert ? '+' : change.isDelete ? '-' : ' ') + change.content;
}

// New-side line when the change exists there, old-side line for deletions.
function lineInfo(changes) {
  const newLines = changes
    .map((c) => (c.type === 'normal' ? c.newLineNumber : c.isInsert ? c.lineNumber : null))
    .filter((n) => n !== null);
  if (newLines.length > 0) {
    return { side: 'new', startLine: newLines[0], endLine: newLines[newLines.length - 1] };
  }
  const oldLines = changes.map((c) => c.lineNumber);
  return { side: 'old', startLine: oldLines[0], endLine: oldLines[oldLines.length - 1] };
}

function CommentForm({ initial = '', onSave, onCancel }) {
  const [body, setBody] = useState(initial);
  return (
    <div className="bg-blue-50 p-2 font-sans">
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment… (Shift-click another line to comment on a range)"
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
          Save
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const range =
    comment.endLine && comment.endLine !== comment.startLine
      ? `L${comment.startLine}–L${comment.endLine}`
      : `L${comment.startLine}`;

  if (editing) {
    return (
      <CommentForm
        initial={comment.body}
        onCancel={() => setEditing(false)}
        onSave={(body) => {
          onUpdate(comment.id, { body });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div
      className={`border-t border-amber-200 bg-amber-50 px-3 py-2 font-sans text-sm ${
        comment.included === false ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[10px] text-gray-500">
            {range}
            {comment.commitSha && ` · @${comment.commitSha.slice(0, 7)}`}
          </span>
          <p className="whitespace-pre-wrap">{comment.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-gray-600" title="Include in the generated prompt">
            <input
              type="checkbox"
              checked={comment.included !== false}
              onChange={(e) => onUpdate(comment.id, { included: e.target.checked })}
            />
            include
          </label>
          <button onClick={() => setEditing(true)} className="rounded px-1 text-gray-500 hover:bg-amber-100">
            Edit
          </button>
          <button
            title="Delete comment"
            onClick={() => onDelete(comment.id)}
            className="rounded px-1 text-gray-400 hover:bg-amber-100 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileDiff({ file, comments, onCreate, onUpdate, onDelete }) {
  const [draft, setDraft] = useState(null); // {hunk, anchorIndex, startIndex, endIndex, changeKey}
  const path = filePath(file);

  const byKey = {};
  for (const c of comments) (byKey[c.changeKey] ??= []).push(c);
  if (draft) byKey[draft.changeKey] ??= [];

  const saveDraft = (body) => {
    const changes = draft.hunk.changes.slice(draft.startIndex, draft.endIndex + 1);
    const context = draft.hunk.changes.slice(Math.max(0, draft.startIndex - 2), draft.endIndex + 3);
    onCreate({
      filePath: path,
      changeKey: draft.changeKey,
      ...lineInfo(changes),
      snippet: context.map(diffLine).join('\n'),
      body,
    });
    setDraft(null);
  };

  const widgets = Object.fromEntries(
    Object.entries(byKey).map(([key, list]) => [
      key,
      <div className="border-b border-amber-200">
        {list.map((c) => (
          <CommentCard key={c.id} comment={c} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {draft?.changeKey === key && <CommentForm onCancel={() => setDraft(null)} onSave={saveDraft} />}
      </div>,
    ])
  );

  // ponytail: v3.3 Hunk ignores its own event props — events must go on Diff
  const gutterEvents = {
    onClick: ({ change }, event) => {
      const hunk = file.hunks.find((h) => h.changes.includes(change));
      if (!hunk) return;
      const index = hunk.changes.indexOf(change);
      setDraft((prev) => {
        if (event?.shiftKey && prev && prev.hunk === hunk) {
          const startIndex = Math.min(prev.anchorIndex, index);
          const endIndex = Math.max(prev.anchorIndex, index);
          return { ...prev, startIndex, endIndex, changeKey: getChangeKey(hunk.changes[endIndex]) };
        }
        return { hunk, anchorIndex: index, startIndex: index, endIndex: index, changeKey: getChangeKey(change) };
      });
    },
  };

  const selectedChanges = draft
    ? draft.hunk.changes.slice(draft.startIndex, draft.endIndex + 1).map(getChangeKey)
    : [];

  return (
    <section id={path} className="mb-4 overflow-hidden rounded-md border border-gray-300">
      <header className="flex items-center gap-2 border-b border-gray-300 bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700">
        {file.type === 'rename' ? `${file.oldPath} → ${file.newPath}` : path}
        {file.type === 'add' && <span className="text-green-700">added</span>}
        {file.type === 'delete' && <span className="text-red-700">deleted</span>}
        {comments.length > 0 && (
          <span className="rounded-full bg-amber-200 px-2 font-sans text-[10px]">{comments.length}</span>
        )}
      </header>
      <Diff
        viewType="unified"
        diffType={file.type}
        hunks={file.hunks}
        widgets={widgets}
        gutterEvents={gutterEvents}
        selectedChanges={selectedChanges}
      >
        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    </section>
  );
}
