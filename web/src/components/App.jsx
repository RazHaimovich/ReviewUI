import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { parseDiff } from 'react-diff-view'
import {
  ALargeSmallIcon,
  ArrowRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  Columns2Icon,
  GitCompareIcon,
  Loader2Icon,
  MessagesSquareIcon,
  MoonIcon,
  PilcrowIcon,
  RotateCcwIcon,
  Rows3Icon,
  SearchIcon,
  SparklesIcon,
  SunIcon
} from 'lucide-react'
import {
  getRepo,
  getCommits,
  getDiff,
  getFileDiff,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  generatePrompt
} from '../lib/api.js'
import { filterEntries, isFiltering, NO_FILTER } from '../lib/fileFilter.js'
import { isTypingTarget, nextPath } from '../lib/keyNav.js'
import CommitBar from './CommitBar.jsx'
import CommentsModal from './CommentsModal.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import FileDiff, { filePath } from './FileDiff.jsx'
import FileTree from './FileTree.jsx'
import PromptModal from './PromptModal.jsx'
import Select from './Select.jsx'
import ShortcutsModal from './ShortcutsModal.jsx'
import Tooltip from './Tooltip.jsx'

// Stable reference for files with no comments, so React.memo on FileDiff holds.
const NO_COMMENTS = []

function DiffSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <div key={i} className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="flex items-center gap-2 border-b border-line bg-panel2 px-3 py-2.5">
            <div className="size-4 rounded bg-line" />
            <div className="h-3 w-48 rounded bg-line" />
            <div className="ml-auto h-3 w-16 rounded bg-line" />
          </div>
          <div className="space-y-2.5 p-3">
            {[82, 64, 74, 56, 70, 60].map((w, j) => (
              <div key={j} className="h-3 rounded bg-panel2" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TreeSkeleton() {
  return (
    <div className="animate-pulse space-y-2 px-1 py-1" aria-hidden="true">
      {[70, 55, 82, 48, 64, 74, 52, 60].map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="size-3.5 shrink-0 rounded bg-line" />
          <div className="h-3 rounded bg-panel2" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

function BranchSelect({ value, branches, onChange, ariaLabel }) {
  return (
    <Select
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      options={branches.map(b => ({ value: b, label: b }))}
      className="rounded-md bg-panel2 px-2 py-1 font-mono text-xs text-ink hover:bg-line"
    />
  )
}

function useTheme() {
  // Start from an explicit choice if the user made one, else the OS preference.
  const [dark, setDark] = useState(() =>
    localStorage.reviewuiTheme
      ? localStorage.reviewuiTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Follow live OS changes only while the user hasn't overridden the theme.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = e => {
      if (!localStorage.reviewuiTheme) setDark(e.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  // Toggling is an explicit choice: persist it (this is what makes it sticky).
  const setTheme = value => {
    localStorage.reviewuiTheme = value ? 'dark' : 'light'
    setDark(value)
  }

  return [dark, setTheme]
}

const FONT_SIZES = { small: '15px', medium: '17px', large: '19px' }
const FONT_ORDER = ['small', 'medium', 'large']

function useFontSize() {
  const [size, setSize] = useState(() => localStorage.reviewuiFontSize || 'medium')
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[size] ?? FONT_SIZES.medium
    localStorage.reviewuiFontSize = size
  }, [size])
  const cycle = () => setSize(s => FONT_ORDER[(FONT_ORDER.indexOf(s) + 1) % FONT_ORDER.length])
  return [size, cycle]
}

function useIgnoreWs() {
  const [ignoreWs, setIgnoreWs] = useState(() => localStorage.reviewuiIgnoreWs === '1')
  useEffect(() => {
    localStorage.reviewuiIgnoreWs = ignoreWs ? '1' : '0'
  }, [ignoreWs])
  return [ignoreWs, () => setIgnoreWs(v => !v)]
}

export default function App() {
  const [repo, setRepo] = useState(null)
  const [base, setBase] = useState(null)
  const [head, setHead] = useState(null)
  const [commits, setCommits] = useState([])
  const [view, setView] = useState('final') // 'final' or a commit sha
  const [mode, setMode] = useState('single')
  const [viewType, setViewType] = useState('unified')
  const [fileList, setFileList] = useState([]) // ordered [{ path, adds, dels, oversized, binary, type }]
  const [parsed, setParsed] = useState(() => new Map()) // path -> parsed diff file (loaded)
  const [comments, setComments] = useState([])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [reviewed, setReviewed] = useState(() => new Set())
  const [prompt, setPrompt] = useState(null)
  const [summary, setSummary] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [filter, setFilter] = useState(NO_FILTER)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [focused, setFocused] = useState(null)
  const filterRef = useRef(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [uncommittedView, setUncommittedView] = useState(false)
  const [untracked, setUntracked] = useState([])
  const [notice, setNotice] = useState(null)
  // Bumped by Refresh to re-run the fetches without changing what is requested.
  const [reloadToken, setReloadToken] = useState(0)
  const [error, setError] = useState(null)
  const [dark, setDark] = useTheme()
  const [fontSize, cycleFontSize] = useFontSize()
  const [ignoreWs, toggleIgnoreWs] = useIgnoreWs()

  useEffect(() => {
    getRepo()
      .then(info => {
        setRepo(info)
        setBase(info.defaultBase ?? info.branches.find(b => b !== info.current) ?? info.current)
        setHead(info.current)
      })
      .catch(err => setError(err.message))
    getComments()
      .then(setComments)
      .catch(() => {})
  }, [])

  // Changing the comparison starts you at the top; refreshing must not, so this
  // is deliberately separate from the fetch below.
  useEffect(() => {
    setView('final')
  }, [base, head])

  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    if (!base || !head) return
    getCommits({ base, head })
      .then(list => {
        setCommits(list)
        // If what you were looking at is no longer in the branch - you committed
        // it, a rebase rewrote it, it was dropped - fall back to the one view
        // that always exists rather than leaving you on an empty screen.
        const current = viewRef.current
        if (current !== 'final' && !list.some(c => c.sha === current)) {
          setView('final')
          setNotice('What you were viewing is no longer in this branch, so this is the final result.')
        }
      })
      .catch(err => setError(err.message))
  }, [base, head, reloadToken])

  // The single derivation of "which diff am I looking at". Both the whole-diff
  // fetch and the single-file fetch send it, so a new request parameter is added
  // in one place instead of three.
  const diffParams = useMemo(() => {
    const params = { base, head }
    if (view !== 'final') Object.assign(params, { commit: view, mode })
    // Only present when on: an absent param can't be misread as truthy the way
    // the string "false" would be.
    if (ignoreWs) params.ws = 1
    return params
  }, [base, head, view, mode, ignoreWs])

  // Identifies the current diff view; a late async load whose key no longer
  // matches is discarded so it can't inject a stale view's hunks. Derived from
  // the params so anything that changes the request also changes the key.
  const diffKey = JSON.stringify(diffParams)
  const diffKeyRef = useRef(diffKey)
  diffKeyRef.current = diffKey

  useEffect(() => {
    if (!diffParams.base || !diffParams.head) return
    let stale = false
    setLoadingDiff(true)
    getDiff(diffParams)
      .then(({ diff, files: list, uncommitted, untracked: untrackedPaths }) => {
        if (stale) return
        const map = new Map()
        if (diff.trim()) for (const f of parseDiff(diff)) map.set(filePath(f), f)
        setParsed(map)
        setFileList(list ?? [])
        // The server decides whether this view spans the working tree, so
        // comments made here can record that their lines may move.
        setUncommittedView(Boolean(uncommitted))
        setUntracked(untrackedPaths ?? [])
        setError(null)
      })
      .catch(err => !stale && setError(err.message))
      .finally(() => !stale && setLoadingDiff(false))
    return () => {
      stale = true
    }
  }, [diffParams, reloadToken])

  // Fetches one file's diff and merges it in: used both to load a long file the
  // server omitted, and to re-fetch a file with more context lines.
  const loadFile = useCallback(
    async (path, context) => {
      const key = diffKeyRef.current
      try {
        const params = { ...diffParams, file: path }
        if (context != null) params.context = context
        const text = await getFileDiff(params)
        // Bail if the view changed while fetching - else we'd merge stale hunks.
        if (diffKeyRef.current !== key) return
        const [f] = parseDiff(text)
        if (f) setParsed(prev => new Map(prev).set(filePath(f), f))
      } catch (err) {
        setError(err.message)
      }
    },
    [diffParams]
  )

  // Refreshing is always a deliberate act: nothing here polls or listens for
  // focus. A working tree changes under you, and comment widgets are keyed by a
  // change that a silent refetch could remove, which would make a comment vanish
  // from the file while it stayed in the store and in the prompt.
  const onRefresh = () => {
    setNotice(null)
    getRepo()
      .then(info => {
        setRepo(info)
        // A branch that disappeared while reviewing would otherwise leave the
        // picker pointing at nothing.
        if (!info.branches.includes(base)) setBase(info.defaultBase ?? info.current)
        if (!info.branches.includes(head)) setHead(info.current)
      })
      .catch(err => setError(err.message))
    setReloadToken(t => t + 1)
  }

  const refreshComments = useCallback(() => getComments().then(setComments), [])
  const onCreateComment = useCallback(
    comment =>
      createComment({
        ...comment,
        commitSha: view === 'final' ? null : view,
        mode: view === 'final' ? null : mode,
        uncommitted: uncommittedView
      })
        .then(refreshComments)
        .catch(err => setError(err.message)),
    [view, mode, uncommittedView, refreshComments]
  )
  const onUpdateComment = useCallback(
    (id, patch) =>
      updateComment(id, patch)
        .then(refreshComments)
        .catch(err => setError(err.message)),
    [refreshComments]
  )
  const onDeleteComment = useCallback(
    id =>
      deleteComment(id)
        .then(refreshComments)
        .catch(err => setError(err.message)),
    [refreshComments]
  )

  // Returns the fresh prompt text so callers (e.g. Copy) can use it without
  // racing the async state update.
  const onGenerate = () =>
    generatePrompt({ base, head, summary })
      .then(text => {
        setPrompt(text)
        return text
      })
      .catch(err => {
        setError(err.message)
        return null
      })

  const onReset = async () => {
    const all = await getComments().catch(() => [])
    // allSettled so one failed delete doesn't abort the rest and leave a half-reset.
    const results = await Promise.allSettled(all.map(c => deleteComment(c.id)))
    setReviewed(new Set())
    setCollapsed(new Set())
    setSummary('')
    // Re-fetch to reflect what actually remains if any delete failed.
    await refreshComments().catch(() => setComments([]))
    if (results.some(r => r.status === 'rejected')) setError('Some comments could not be deleted.')
    setConfirmReset(false)
  }

  const toggleCollapse = useCallback(
    path =>
      setCollapsed(prev => {
        const next = new Set(prev)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      }),
    []
  )

  // Viewed and collapsed are separate: marking viewed auto-collapses once, but
  // the file can be re-expanded via its chevron while staying viewed. Read the
  // latest `reviewed` through a ref so the handler ref stays stable for memo.
  const reviewedRef = useRef(reviewed)
  reviewedRef.current = reviewed
  const toggleReviewed = useCallback(path => {
    const becomingReviewed = !reviewedRef.current.has(path)
    setReviewed(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (becomingReviewed) setCollapsed(prev => new Set(prev).add(path))
  }, [])

  // Group comments by file path once per change, instead of filtering per file.
  const commentsByPath = useMemo(() => {
    const map = new Map()
    for (const c of comments) {
      const list = map.get(c.filePath)
      if (list) list.push(c)
      else map.set(c.filePath, [c])
    }
    return map
  }, [comments])

  // One entry per changed file in git order; merge the loaded diff (if any).
  // Memoized so each `file` object keeps a stable identity for React.memo.
  const entries = useMemo(
    () =>
      fileList.map(s => {
        const f = parsed.get(s.path)
        return {
          path: s.path,
          adds: s.adds,
          dels: s.dels,
          oversized: s.oversized,
          binary: s.binary,
          type: s.type ?? 'modify', // server type; parsed diff (if loaded) refines paths below
          ...(f && { hunks: f.hunks, type: f.type, oldPath: f.oldPath, newPath: f.newPath })
        }
      }),
    [fileList, parsed]
  )

  const treeEntries = useMemo(
    () =>
      entries.map(e => ({
        path: e.path,
        type: e.type ?? 'modify',
        adds: e.adds,
        dels: e.dels,
        comments: (commentsByPath.get(e.path) ?? NO_COMMENTS).length,
        reviewed: reviewed.has(e.path)
      })),
    [entries, commentsByPath, reviewed]
  )

  // The sidebar shows the filtered list; the diff column still shows everything.
  const visibleEntries = useMemo(() => filterEntries(treeEntries, filter), [treeEntries, filter])
  const filtering = isFiltering(filter)

  // Everything the key handler needs, refreshed every render so the listener can
  // be attached once instead of resubscribing whenever the review changes.
  const keysRef = useRef(null)
  keysRef.current = {
    paths: visibleEntries.map(e => e.path),
    focused,
    setFocused,
    toggleReviewed,
    canGenerate: comments.length > 0,
    onGenerate,
    focusFilter: () => filterRef.current?.focus(),
    showShortcuts: () => setShowShortcuts(true),
    // Closes the topmost dialog, matching the order they stack in the tree.
    closeTopModal: () => {
      if (confirmReset) setConfirmReset(false)
      else if (prompt !== null) setPrompt(null)
      else if (showComments) setShowComments(false)
      else if (showShortcuts) setShowShortcuts(false)
    }
  }

  useEffect(() => {
    const onKey = event => {
      // Let the browser and OS keep their chords.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const keys = keysRef.current
      const target = event.target
      const typing = isTypingTarget(target)

      if (event.key === 'Escape') {
        if (typing) target.blur()
        else keys.closeTopModal()
        return
      }
      // Writing a comment must never trigger navigation.
      if (typing) return

      if (event.key === 'j' || event.key === 'k') {
        const next = nextPath(keys.paths, keys.focused, event.key === 'j' ? 1 : -1)
        if (!next) return
        event.preventDefault()
        keys.setFocused(next)
        document.getElementById(next)?.scrollIntoView({ block: 'start' })
      } else if (event.key === 'v') {
        if (keys.focused) keys.toggleReviewed(keys.focused)
      } else if (event.key === '/') {
        event.preventDefault()
        keys.focusFilter()
      } else if (event.key === 'g') {
        if (keys.canGenerate) keys.onGenerate()
      } else if (event.key === '?') {
        keys.showShortcuts()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!repo) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-muted">
        {error ? (
          <p className="font-mono text-sm text-del">ReviewUI error: {error}</p>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <Loader2Icon className="size-5 animate-spin" />
            Loading…
          </span>
        )}
      </div>
    )
  }

  const paths = fileList.map(s => s.path)
  const allCollapsed = paths.length > 0 && paths.every(p => collapsed.has(p))
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(paths))
  const reviewedCount = paths.filter(p => reviewed.has(p)).length

  const iconButton = 'grid size-8 place-items-center rounded-md bg-panel2 text-muted hover:bg-line hover:text-ink'

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-accent text-on-accent">
              <GitCompareIcon className="size-3.5" strokeWidth={2.5} />
            </span>
            <h1 className="text-sm font-semibold tracking-tight">{repo.name}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <BranchSelect ariaLabel="Base branch" value={base} branches={repo.branches} onChange={setBase} />
            <ArrowRightIcon className="size-4 shrink-0 text-muted" />
            <BranchSelect ariaLabel="Compare branch" value={head} branches={repo.branches} onChange={setHead} />
          </div>

          {!loadingDiff && (
            <span className="text-xs text-muted tnum">
              {fileList.length} {fileList.length === 1 ? 'file' : 'files'}
              {reviewedCount > 0 && ` · ${reviewedCount}/${fileList.length} viewed`}
            </span>
          )}

          <span className="grow" />

          {/* Views: how the diff is displayed */}
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-md bg-panel2 p-0.5">
              {[
                ['unified', Rows3Icon, 'Unified view'],
                ['split', Columns2Icon, 'Split view']
              ].map(([type, Icon, label]) => (
                <Tooltip key={type} label={label}>
                  <button
                    onClick={() => setViewType(type)}
                    className={clsx(
                      'grid size-7 place-items-center rounded',
                      viewType === type ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                </Tooltip>
              ))}
            </div>

            <Tooltip label={ignoreWs ? 'Show whitespace changes' : 'Ignore whitespace changes'}>
              <button
                onClick={toggleIgnoreWs}
                aria-pressed={ignoreWs}
                className={clsx(
                  'grid size-8 place-items-center rounded-md',
                  ignoreWs ? 'bg-accent-soft text-accent' : 'bg-panel2 text-muted hover:bg-line hover:text-ink'
                )}
              >
                <PilcrowIcon className="size-4" />
              </button>
            </Tooltip>

            <Tooltip label={`Font size: ${fontSize}`}>
              <button onClick={cycleFontSize} className={iconButton}>
                <ALargeSmallIcon className="size-4" />
              </button>
            </Tooltip>

            <Tooltip label={dark ? 'Light theme' : 'Dark theme'}>
              <button onClick={() => setDark(!dark)} className={iconButton}>
                {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
              </button>
            </Tooltip>
          </div>

          <div className="h-6 w-px bg-line" />

          {/* Actions: operate on the review */}
          <div className="flex items-center gap-1">
            <Tooltip
              label={
                fileList.length === 0 ? 'No files to review' : allCollapsed ? 'Expand all files' : 'Collapse all files'
              }
            >
              <button
                onClick={toggleAll}
                disabled={fileList.length === 0}
                className={clsx(iconButton, 'disabled:pointer-events-none disabled:opacity-40')}
              >
                {allCollapsed ? <ChevronsUpDownIcon className="size-4" /> : <ChevronsDownUpIcon className="size-4" />}
              </button>
            </Tooltip>

            <Tooltip label={comments.length === 0 ? 'No comments yet' : 'All comments'}>
              <button
                onClick={() => setShowComments(true)}
                disabled={comments.length === 0}
                className={clsx(iconButton, 'relative disabled:pointer-events-none disabled:opacity-40')}
              >
                <MessagesSquareIcon className="size-4" />
                {comments.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-accent text-[0.625rem] text-on-accent tnum">
                    {comments.length}
                  </span>
                )}
              </button>
            </Tooltip>

            <Tooltip label={comments.length === 0 && reviewed.size === 0 ? 'Nothing to reset' : 'Reset review'}>
              <button
                onClick={() => setConfirmReset(true)}
                disabled={comments.length === 0 && reviewed.size === 0}
                className={clsx(iconButton, 'disabled:pointer-events-none disabled:opacity-40')}
              >
                <RotateCcwIcon className="size-4" />
              </button>
            </Tooltip>
          </div>

          <div className="h-6 w-px bg-line" />

          <Tooltip label={comments.length === 0 ? 'Add a comment first' : ''}>
            <button
              onClick={onGenerate}
              disabled={comments.length === 0}
              className="flex items-center gap-2 rounded-lg bg-linear-to-b from-accent to-accent-hover px-4 py-2 text-sm font-semibold text-on-accent shadow-sm ring-1 ring-inset ring-white/15 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
            >
              <SparklesIcon className="size-4" />
              Generate prompt
              {comments.length > 0 && (
                <span className="rounded bg-black/20 px-1.5 text-xs tnum">{comments.length}</span>
              )}
            </button>
          </Tooltip>
        </div>
        <div className="border-t border-line px-4 py-2">
          <CommitBar
            commits={commits}
            view={view}
            mode={mode}
            onView={setView}
            onMode={setMode}
            onRefresh={onRefresh}
          />
        </div>
      </header>

      {error && (
        <p className="mx-4 mt-4 rounded-md border border-del/30 bg-del/10 px-3 py-2 font-mono text-xs text-del">
          {error}
        </p>
      )}

      {notice && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-xs text-muted">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-auto shrink-0 text-faint hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      <main className="mx-auto flex max-w-[1600px] items-start gap-5 p-4">
        <nav className="sticky top-28 max-h-[calc(100vh-8rem)] w-72 shrink-0 overflow-y-auto rounded-lg border border-line bg-panel p-2">
          <div className="flex items-baseline gap-2 px-2 pt-1">
            <p className="eyebrow">Changed files</p>
            {filtering && (
              <span className="ml-auto font-mono text-[0.6875rem] text-faint tnum">
                {visibleEntries.length} of {treeEntries.length}
              </span>
            )}
          </div>

          <div className="px-1 pb-2 pt-1.5">
            <div className="flex items-center gap-1.5 rounded-md bg-panel2 px-2 py-1">
              <SearchIcon className="size-3.5 shrink-0 text-faint" />
              <input
                ref={filterRef}
                value={filter.query}
                onChange={e => setFilter(f => ({ ...f, query: e.target.value }))}
                placeholder="Filter files"
                aria-label="Filter files"
                className="w-full bg-transparent font-mono text-xs text-ink outline-none placeholder:text-faint"
              />
            </div>
            <div className="mt-1.5 flex gap-1">
              {[
                ['hideViewed', 'Hide viewed'],
                ['onlyCommented', 'Only commented']
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(f => ({ ...f, [key]: !f[key] }))}
                  aria-pressed={filter[key]}
                  className={clsx(
                    'rounded-md border px-1.5 py-0.5 text-[0.6875rem]',
                    filter[key] ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:bg-panel2'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {untracked.length > 0 && (
            <p
              className="mb-1 px-2 text-[0.6875rem] leading-snug text-muted"
              title={untracked.join('\n')}
              aria-label={`${untracked.length} untracked files are not shown`}
            >
              {untracked.length} untracked {untracked.length === 1 ? 'file' : 'files'} not shown.{' '}
              <span className="font-mono">git add</span> to include.
            </p>
          )}

          {loadingDiff ? (
            <TreeSkeleton />
          ) : (
            <FileTree
              entries={visibleEntries}
              onToggleReviewed={toggleReviewed}
              emptyLabel={filtering ? 'No files match' : 'No changes'}
            />
          )}
        </nav>
        <div className="min-w-0 flex-1">
          {loadingDiff ? (
            <DiffSkeleton />
          ) : entries.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed border-line py-24 text-center">
              <p className="text-sm text-muted">No changes between these branches.</p>
              <p className="mt-1 font-mono text-xs text-faint">Pick a different base or compare branch.</p>
            </div>
          ) : (
            entries.map(e => (
              <FileDiff
                key={e.path}
                file={e}
                viewType={viewType}
                comments={commentsByPath.get(e.path) ?? NO_COMMENTS}
                collapsed={collapsed.has(e.path)}
                onToggleCollapse={toggleCollapse}
                reviewed={reviewed.has(e.path)}
                onToggleReviewed={toggleReviewed}
                onCreate={onCreateComment}
                onUpdate={onUpdateComment}
                onDelete={onDeleteComment}
                onLoad={loadFile}
                viewKey={diffKey}
                focused={focused === e.path}
              />
            ))
          )}
        </div>
      </main>

      {prompt !== null && (
        <PromptModal
          text={prompt}
          summary={summary}
          onSummaryChange={setSummary}
          onRegenerate={onGenerate}
          onClose={() => setPrompt(null)}
        />
      )}

      {showComments && (
        <CommentsModal
          comments={comments}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          onReset={() => {
            setShowComments(false)
            setConfirmReset(true)
          }}
          onClose={() => setShowComments(false)}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {confirmReset && (
        <ConfirmModal
          title="Reset review?"
          message="This clears all comments and your viewed progress. It can't be undone."
          confirmLabel="Reset"
          danger
          onConfirm={onReset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
