import { useEffect, useMemo, useRef, useState } from 'react';
import { Diff, Hunk, getChangeKey, tokenize } from 'react-diff-view';
import clsx from 'clsx';
import { ChevronDownIcon, ChevronRightIcon, MessageSquarePlusIcon, PlusIcon } from 'lucide-react';
import { highlighter, languageFor } from '../lib/highlight.js';
import { lineRange } from '../lib/lineRange.js';
import { CommentCard, CommentForm } from './Comment.jsx';
import Tooltip from './Tooltip.jsx';

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
        <Tooltip label={collapsed ? 'Expand file' : 'Collapse file'}>
          <button
            onClick={onToggleCollapse}
            className="grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-ink"
          >
            {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          </button>
        </Tooltip>
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
        <Tooltip label="Comment on file">
          <button
            onClick={() => setFileDraft(true)}
            className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-ink"
          >
            <MessageSquarePlusIcon className="size-4" />
          </button>
        </Tooltip>
        <label
          className={clsx(
            'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-sans text-[11px]',
            reviewed ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:bg-panel'
          )}
        >
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
