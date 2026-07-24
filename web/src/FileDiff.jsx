import { useMemo, useState } from 'react';
import { Diff, Hunk, getChangeKey, tokenize } from 'react-diff-view';
import { CheckIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { highlighter, languageFor } from './highlight.js';

export function filePath(file) {
  return file.type === 'delete' ? file.oldPath : file.newPath;
}

export function fileStats(file) {
  let adds = 0;
  let dels = 0;
  for (const hunk of file.hunks) {
    for (const change of hunk.changes) {
      if (change.isInsert) adds += 1;
      if (change.isDelete) dels += 1;
    }
  }
  return { adds, dels };
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
    <div className="bg-accent-soft/60 p-2.5 font-sans">
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment…  (Shift-click another line to select a range)"
        className="w-full resize-y rounded-md border border-line-strong bg-panel p-2 text-sm text-ink placeholder:text-faint"
      />
      <div className="mt-2 flex justify-end gap-2 text-sm">
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-muted hover:bg-panel2 hover:text-ink"
        >
          Cancel
        </button>
        <button
          disabled={!body.trim()}
          onClick={() => onSave(body.trim())}
          className="rounded-md bg-accent px-3 py-1 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-40"
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
      ? `L${comment.startLine}–${comment.endLine}`
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

  const excluded = comment.included === false;
  const iconBtn = 'grid size-6 place-items-center rounded text-faint hover:bg-panel2 hover:text-ink';

  return (
    <div className={`bg-accent-soft/50 px-3 py-2.5 font-sans text-sm ${excluded ? 'opacity-45' : ''}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-wide text-accent tnum">{range}</span>
        {comment.commitSha && (
          <span className="rounded bg-panel2 px-1.5 font-mono text-[10px] text-muted">
            @{comment.commitSha.slice(0, 7)}
          </span>
        )}
        <span className="grow" />
        <button
          title={excluded ? 'Include in prompt' : 'Exclude from prompt'}
          onClick={() => onUpdate(comment.id, { included: excluded })}
          className={`grid size-6 place-items-center rounded ${
            excluded ? 'text-faint hover:bg-panel2' : 'text-accent hover:bg-panel2'
          }`}
        >
          <CheckIcon className="size-3.5" strokeWidth={excluded ? 2 : 3} />
        </button>
        <button title="Edit" onClick={() => setEditing(true)} className={iconBtn}>
          <PencilIcon className="size-3.5" />
        </button>
        <button title="Delete" onClick={() => onDelete(comment.id)} className={`${iconBtn} hover:text-del`}>
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-ink">{comment.body}</p>
      {excluded && <p className="mt-1 font-mono text-[10px] text-faint">Excluded from prompt</p>}
    </div>
  );
}

export default function FileDiff({ file, viewType, comments, onCreate, onUpdate, onDelete }) {
  const [draft, setDraft] = useState(null); // {hunk, anchorIndex, startIndex, endIndex, changeKey}
  const path = filePath(file);
  const { adds, dels } = fileStats(file);

  const tokens = useMemo(() => {
    const language = languageFor(path);
    if (!language) return undefined;
    try {
      return tokenize(file.hunks, { highlight: true, refractor: highlighter, language });
    } catch {
      return undefined;
    }
  }, [file, path]);

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
      <div className="divide-y divide-line border-y border-line">
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

  const badge =
    file.type === 'add'
      ? { text: 'added', cls: 'text-add' }
      : file.type === 'delete'
        ? { text: 'deleted', cls: 'text-del' }
        : file.type === 'rename'
          ? { text: 'renamed', cls: 'text-accent' }
          : null;

  return (
    <section id={path} className="mb-4 scroll-mt-28 overflow-hidden rounded-lg border border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line bg-panel2 px-3 py-2 font-mono text-xs">
        <span className="truncate text-ink">
          {file.type === 'rename' ? `${file.oldPath} → ${file.newPath}` : path}
        </span>
        {badge && <span className={`shrink-0 ${badge.cls}`}>{badge.text}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 tnum">
          {comments.length > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-accent-soft text-[10px] text-accent">
              {comments.length}
            </span>
          )}
          {adds > 0 && <span className="text-add">+{adds}</span>}
          {dels > 0 && <span className="text-del">−{dels}</span>}
        </span>
      </header>
      <Diff
        viewType={viewType}
        diffType={file.type}
        hunks={file.hunks}
        widgets={widgets}
        gutterEvents={gutterEvents}
        selectedChanges={selectedChanges}
        tokens={tokens}
      >
        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    </section>
  );
}
