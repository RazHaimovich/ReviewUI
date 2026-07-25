import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Diff, Hunk, getChangeKey, markEdits, tokenize } from 'react-diff-view'
import clsx from 'clsx'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  PlusIcon,
  UnfoldVerticalIcon
} from 'lucide-react'
import { contextLabel, nextContext } from '../lib/diffContext.js'
import { highlighter, languageFor } from '../lib/highlight.js'
import { lineNumberOn, lineRange } from '../lib/lineRange.js'
import { CommentCard, CommentForm } from './Comment.jsx'
import Tooltip from './Tooltip.jsx'

export function filePath(file) {
  return file.type === 'delete' ? file.oldPath : file.newPath
}

function FileDiff({
  file,
  viewType,
  comments,
  collapsed,
  onToggleCollapse,
  reviewed,
  onToggleReviewed,
  onCreate,
  onUpdate,
  onDelete,
  onLoad,
  viewKey
}) {
  // draft: { hunk, anchorIndex, startIndex, endIndex, changeKey, open }
  const [draft, setDraft] = useState(null)
  const [fileDraft, setFileDraft] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [context, setContext] = useState(null)

  // The parsed diff is replaced wholesale when the view changes, but this state
  // outlives it, so reset or the control would advertise context the diff lacks.
  useEffect(() => setContext(null), [viewKey])
  const draggingRef = useRef(false)
  const path = file.path ?? filePath(file)
  const adds = file.adds ?? 0
  const dels = file.dels ?? 0
  // A long file omitted by the server has no hunks until the user loads it.
  const loaded = Array.isArray(file.hunks)

  const fileComments = comments.filter(c => c.scope === 'file')
  const lineComments = comments.filter(c => c.scope !== 'file')

  const saveFileComment = body => {
    onCreate({ filePath: path, scope: 'file', body })
    setFileDraft(false)
  }

  // Re-fetch just this file with the next context width. Set optimistically: a
  // failed fetch surfaces in the error banner rather than needing its own state.
  const cycleContext = () => {
    const next = nextContext(context)
    setContext(next)
    onLoad(path, next)
  }

  // markEdits narrows the highlight to the characters that actually changed, so a
  // one-character edit doesn't light up the whole line. It runs whether or not a
  // language resolved, which is why the highlight options are spread in
  // conditionally rather than returning early on an unknown file type.
  const tokens = useMemo(() => {
    if (!loaded || collapsed) return undefined
    const language = languageFor(path)
    try {
      return tokenize(file.hunks, {
        enhancers: [markEdits(file.hunks, { type: 'block' })],
        ...(language && { highlight: true, refractor: highlighter, language })
      })
    } catch {
      return undefined
    }
  }, [file, path, loaded, collapsed])

  const byKey = {}
  for (const c of lineComments) (byKey[c.changeKey] ??= []).push(c)
  if (draft?.open) byKey[draft.changeKey] ??= []

  const saveDraft = body => {
    onCreate({
      filePath: path,
      changeKey: draft.changeKey,
      ...lineRange(draft.hunk.changes, draft.startIndex, draft.endIndex),
      body
    })
    setDraft(null)
  }

  const widgets = Object.fromEntries(
    Object.entries(byKey).map(([key, list]) => [
      key,
      <div className="divide-y divide-line border-y border-line bg-panel2">
        {list.map(c => (
          <CommentCard key={c.id} comment={c} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {draft?.open && draft.changeKey === key && <CommentForm onCancel={() => setDraft(null)} onSave={saveDraft} />}
      </div>
    ])
  )

  const hunkOf = change => file.hunks.find(h => h.changes.includes(change))

  // ponytail: v3.3 Hunk ignores its own event props - events go on Diff.
  // Gutter-only interaction: press = anchor, drag = extend, release = open form.
  const gutterEvents = {
    onMouseDown: ({ change }, event) => {
      const hunk = hunkOf(change)
      if (!hunk) return
      event.preventDefault() // stop text selection while dragging the gutter
      const index = hunk.changes.indexOf(change)
      draggingRef.current = true
      setDraft({
        hunk,
        anchorIndex: index,
        startIndex: index,
        endIndex: index,
        changeKey: getChangeKey(change),
        open: false
      })
      // Attach the release handler only for the duration of this drag, so we
      // don't keep one global listener per mounted file. Release may land
      // outside the gutter, so it must be on the window.
      const onUp = () => {
        window.removeEventListener('mouseup', onUp)
        if (!draggingRef.current) return
        draggingRef.current = false
        setDraft(prev => (prev ? { ...prev, open: true } : prev))
      }
      window.addEventListener('mouseup', onUp)
    },
    onMouseEnter: ({ change }) => {
      if (!draggingRef.current) return
      const hunk = hunkOf(change)
      setDraft(prev => {
        if (!prev || hunk !== prev.hunk) return prev
        const index = hunk.changes.indexOf(change)
        const startIndex = Math.min(prev.anchorIndex, index)
        const endIndex = Math.max(prev.anchorIndex, index)
        return { ...prev, startIndex, endIndex, changeKey: getChangeKey(hunk.changes[endIndex]) }
      })
    }
  }

  const renderGutter = ({ change, renderDefault, wrapInAnchor }) => {
    if (!change) return wrapInAnchor(renderDefault())
    return (
      <>
        {wrapInAnchor(renderDefault())}
        <span className="gutter-plus" aria-hidden="true">
          <PlusIcon className="size-3" strokeWidth={3} />
        </span>
      </>
    )
  }

  const selectedChanges = draft ? draft.hunk.changes.slice(draft.startIndex, draft.endIndex + 1).map(getChangeKey) : []

  // Highlight every line within a comment's range (not just its anchor line).
  const commentRanges = lineComments.map(c => ({
    side: c.side,
    start: c.startLine,
    end: c.endLine ?? c.startLine
  }))
  const generateLineClassName = ({ changes }) =>
    changes.some(ch =>
      commentRanges.some(r => {
        const n = ch && lineNumberOn(ch, r.side)
        return n != null && n >= r.start && n <= r.end
      })
    )
      ? 'line-has-comment'
      : undefined

  const badge =
    file.type === 'add'
      ? { text: 'added', cls: 'text-add' }
      : file.type === 'delete'
        ? { text: 'deleted', cls: 'text-del' }
        : file.type === 'rename'
          ? { text: 'renamed', cls: 'text-accent' }
          : null

  return (
    <section id={path} className="mb-4 scroll-mt-28 rounded-lg border border-line bg-panel">
      <header className="sticky top-[6.1rem] z-5 flex items-center gap-2 rounded-t-lg border-b border-line bg-panel2 px-3 py-2 font-mono text-xs">
        <Tooltip label={collapsed ? 'Expand file' : 'Collapse file'}>
          <button
            onClick={() => onToggleCollapse(path)}
            className="grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-line hover:text-ink"
          >
            {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          </button>
        </Tooltip>
        <span className="truncate text-ink">
          {file.type === 'rename' && file.oldPath ? `${file.oldPath} → ${file.newPath}` : path}
        </span>
        {badge && <span className={clsx('shrink-0', badge.cls)}>{badge.text}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 tnum">
          {comments.length > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-accent-soft text-[0.6875rem] text-accent">
              {comments.length}
            </span>
          )}
          {adds > 0 && <span className="text-add">+{adds}</span>}
          {dels > 0 && <span className="text-del">-{dels}</span>}
        </span>
        {loaded && !file.binary && (
          <Tooltip label="Context lines around each change">
            <button
              onClick={cycleContext}
              className="flex shrink-0 items-center gap-1 rounded px-1 text-muted hover:bg-line hover:text-ink"
            >
              <UnfoldVerticalIcon className="size-3.5" />
              <span className="tnum">{contextLabel(context)}</span>
            </button>
          </Tooltip>
        )}
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
            'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-sans text-[0.6875rem]',
            reviewed ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:bg-panel'
          )}
        >
          <input
            type="checkbox"
            checked={!!reviewed}
            onChange={() => onToggleReviewed(path)}
            className="accent-accent"
          />
          Viewed
        </label>
      </header>
      <div className="overflow-hidden rounded-b-lg">
        {(fileComments.length > 0 || fileDraft) && (
          <div className="divide-y divide-line border-b border-line bg-panel2">
            {fileComments.map(c => (
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
        {!collapsed &&
          (loadingFile ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-accent">
              <Loader2Icon className="size-4 animate-spin" />
              Loading…
            </div>
          ) : file.binary ? (
            <p className="py-10 text-center text-sm text-muted">Binary file - not shown.</p>
          ) : loaded ? (
            <Diff
              viewType={viewType}
              diffType={file.type}
              hunks={file.hunks}
              widgets={widgets}
              gutterEvents={gutterEvents}
              renderGutter={renderGutter}
              selectedChanges={selectedChanges}
              generateLineClassName={generateLineClassName}
              tokens={tokens}
            >
              {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
            </Diff>
          ) : (
            <button
              onClick={async () => {
                setLoadingFile(true)
                try {
                  // Hold the spinner briefly so the loading state is visible even
                  // when the fetch is near-instant on a local repo.
                  await Promise.all([onLoad(path), new Promise(r => setTimeout(r, 350))])
                } finally {
                  setLoadingFile(false)
                }
              }}
              className="flex w-full flex-col items-center gap-1 py-10 text-sm text-muted hover:bg-panel2"
            >
              <span>
                This file is large - {(adds + dels).toLocaleString()} lines, {adds} added / {dels} removed.
              </span>
              <span className="font-medium text-accent">Click to view</span>
            </button>
          ))}
      </div>
    </section>
  )
}

export default memo(FileDiff)
