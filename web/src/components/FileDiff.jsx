import { useEffect, useMemo, useRef, useState } from 'react';
import { Diff, Hunk, getChangeKey, tokenize } from 'react-diff-view';
import clsx from 'clsx';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { highlighter, languageFor } from '../lib/highlight.js';
import { lineRange } from '../lib/lineRange.js';

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

function CommentForm({ initial = '', onSave, onCancel, placeholder = 'Leave a comment…  (drag across line numbers to select a range)' }) {
  const [body, setBody] = useState(initial);
  return (
    <div className="bg-accent-soft/60 p-2.5 font-sans">
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
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
    comment.scope === 'file'
      ? 'whole file'
      : comment.endLine && comment.endLine !== comment.startLine
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
    <div className={clsx('bg-accent-soft/50 px-3 py-2.5 font-sans text-sm', excluded && 'opacity-45')}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-wide text-accent tnum">{range}</span>
        {comment.commitSha && (
          <span className="rounded bg-panel2 px-1.5 font-mono text-[11px] text-muted">
            @{comment.commitSha.slice(0, 7)}
          </span>
        )}
        <span className="grow" />
        <button
          title={excluded ? 'Include in prompt' : 'Exclude from prompt'}
          onClick={() => onUpdate(comment.id, { included: excluded })}
          className={clsx('grid size-6 place-items-center rounded hover:bg-panel2', excluded ? 'text-faint' : 'text-accent')}
        >
          <CheckIcon className="size-3.5" strokeWidth={excluded ? 2 : 3} />
        </button>
        <button title="Edit" onClick={() => setEditing(true)} className={iconBtn}>
          <PencilIcon className="size-3.5" />
        </button>
        <button title="Delete" onClick={() => onDelete(comment.id)} className={clsx(iconBtn, 'hover:text-del')}>
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-ink">{comment.body}</p>
      {excluded && <p className="mt-1 font-mono text-[11px] text-faint">Excluded from prompt</p>}
    </div>
  );
}

export default function FileDiff({ file, viewType, comments, collapsed, onToggleCollapse, reviewed, onToggleReviewed, onCreate, onUpdate, onDelete }) {
  // draft: { hunk, anchorIndex, startIndex, endIndex, changeKey, open }
  const [draft, setDraft] = useState(null);
  const [fileDraft, setFileDraft] = useState(false);
  const draggingRef = useRef(false);
  const path = filePath(file);
  const { adds, dels } = fileStats(file);

  const fileComments = comments.filter((c) => c.scope === 'file');
  const lineComments = comments.filter((c) => c.scope !== 'file');

  const saveFileComment = (body) => {
    onCreate({ filePath: path, scope: 'file', body });
    setFileDraft(false);
  };

  // End a drag released anywhere (including outside the gutter) → open the form.
  useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDraft((prev) => (prev ? { ...prev, open: true } : prev));
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

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
  for (const c of lineComments) (byKey[c.changeKey] ??= []).push(c);
  if (draft?.open) byKey[draft.changeKey] ??= [];

  const saveDraft = (body) => {
    onCreate({
      filePath: path,
      changeKey: draft.changeKey,
      ...lineRange(draft.hunk.changes, draft.startIndex, draft.endIndex),
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
        {draft?.open && draft.changeKey === key && (
          <CommentForm onCancel={() => setDraft(null)} onSave={saveDraft} />
        )}
      </div>,
    ])
  );

  const hunkOf = (change) => file.hunks.find((h) => h.changes.includes(change));

  // ponytail: v3.3 Hunk ignores its own event props — events go on Diff.
  // Gutter-only interaction: press = anchor, drag = extend, release = open form.
  const gutterEvents = {
    onMouseDown: ({ change }, event) => {
      const hunk = hunkOf(change);
      if (!hunk) return;
      event.preventDefault(); // stop text selection while dragging the gutter
      const index = hunk.changes.indexOf(change);
      draggingRef.current = true;
      setDraft({ hunk, anchorIndex: index, startIndex: index, endIndex: index, changeKey: getChangeKey(change), open: false });
    },
    onMouseEnter: ({ change }) => {
      if (!draggingRef.current) return;
      const hunk = hunkOf(change);
      setDraft((prev) => {
        if (!prev || hunk !== prev.hunk) return prev;
        const index = hunk.changes.indexOf(change);
        const startIndex = Math.min(prev.anchorIndex, index);
        const endIndex = Math.max(prev.anchorIndex, index);
        return { ...prev, startIndex, endIndex, changeKey: getChangeKey(hunk.changes[endIndex]) };
      });
    },
  };

  const renderGutter = ({ change, renderDefault, wrapInAnchor }) => {
    if (!change) return wrapInAnchor(renderDefault());
    return (
      <>
        {wrapInAnchor(renderDefault())}
        <span className="gutter-plus" aria-hidden="true">
          <PlusIcon className="size-3" strokeWidth={3} />
        </span>
      </>
    );
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
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand file' : 'Collapse file'}
          className="grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-ink"
        >
          {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
        </button>
        <span className="truncate text-ink">
          {file.type === 'rename' ? `${file.oldPath} → ${file.newPath}` : path}
        </span>
        {badge && <span className={clsx('shrink-0', badge.cls)}>{badge.text}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 tnum">
          {comments.length > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-accent-soft text-[11px] text-accent">
              {comments.length}
            </span>
          )}
          {adds > 0 && <span className="text-add">+{adds}</span>}
          {dels > 0 && <span className="text-del">−{dels}</span>}
        </span>
        <button
          onClick={() => setFileDraft(true)}
          title="Comment on file"
          className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-ink"
        >
          <MessageSquarePlusIcon className="size-4" />
        </button>
        <label className="flex shrink-0 items-center gap-1 font-sans text-[11px] text-muted">
          <input type="checkbox" checked={!!reviewed} onChange={onToggleReviewed} className="accent-accent" />
          Viewed
        </label>
      </header>
      {(fileComments.length > 0 || fileDraft) && (
        <div className="divide-y divide-line border-b border-line">
          {fileComments.map((c) => (
            <CommentCard key={c.id} comment={c} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
          {fileDraft && (
            <CommentForm
              placeholder="Comment on the whole file…"
              onCancel={() => setFileDraft(false)}
              onSave={saveFileComment}
            />
          )}
        </div>
      )}
      {!collapsed && (
        <Diff
          viewType={viewType}
          diffType={file.type}
          hunks={file.hunks}
          widgets={widgets}
          gutterEvents={gutterEvents}
          renderGutter={renderGutter}
          selectedChanges={selectedChanges}
          tokens={tokens}
        >
          {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
        </Diff>
      )}
    </section>
  );
}
