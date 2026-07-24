import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { parseDiff } from 'react-diff-view'
import {
  ALargeSmallIcon,
  ArrowRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  Columns2Icon,
  GitCompareIcon,
  MessagesSquareIcon,
  MoonIcon,
  RotateCcwIcon,
  Rows3Icon,
  SparklesIcon,
  SunIcon
} from 'lucide-react'
import {
  getRepo,
  getCommits,
  getDiff,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  generatePrompt
} from '../lib/api.js'
import CommitBar from './CommitBar.jsx'
import CommentsModal from './CommentsModal.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import FileDiff, { filePath, fileStats } from './FileDiff.jsx'
import FileTree from './FileTree.jsx'
import PromptModal from './PromptModal.jsx'
import Select from './Select.jsx'
import Tooltip from './Tooltip.jsx'

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

export default function App() {
  const [repo, setRepo] = useState(null)
  const [base, setBase] = useState(null)
  const [head, setHead] = useState(null)
  const [commits, setCommits] = useState([])
  const [view, setView] = useState('final') // 'final' or a commit sha
  const [mode, setMode] = useState('single')
  const [viewType, setViewType] = useState('unified')
  const [files, setFiles] = useState([])
  const [comments, setComments] = useState([])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [reviewed, setReviewed] = useState(() => new Set())
  const [prompt, setPrompt] = useState(null)
  const [summary, setSummary] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [error, setError] = useState(null)
  const [dark, setDark] = useTheme()
  const [fontSize, cycleFontSize] = useFontSize()

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

  useEffect(() => {
    if (!base || !head) return
    setView('final')
    getCommits({ base, head })
      .then(setCommits)
      .catch(err => setError(err.message))
  }, [base, head])

  useEffect(() => {
    if (!base || !head) return
    const params = { base, head }
    if (view !== 'final') Object.assign(params, { commit: view, mode })
    getDiff(params)
      .then(text => {
        setFiles(text.trim() ? parseDiff(text) : [])
        setError(null)
      })
      .catch(err => setError(err.message))
  }, [base, head, view, mode])

  const refreshComments = () => getComments().then(setComments)
  const onCreateComment = comment =>
    createComment({
      ...comment,
      commitSha: view === 'final' ? null : view,
      mode: view === 'final' ? null : mode
    })
      .then(refreshComments)
      .catch(err => setError(err.message))
  const onUpdateComment = (id, patch) =>
    updateComment(id, patch)
      .then(refreshComments)
      .catch(err => setError(err.message))
  const onDeleteComment = id =>
    deleteComment(id)
      .then(refreshComments)
      .catch(err => setError(err.message))

  const onGenerate = () =>
    generatePrompt({ base, head, summary })
      .then(setPrompt)
      .catch(err => setError(err.message))

  const onReset = async () => {
    try {
      const all = await getComments()
      await Promise.all(all.map(c => deleteComment(c.id)))
      setComments([])
      setReviewed(new Set())
      setCollapsed(new Set())
      setSummary('')
    } catch (err) {
      setError(err.message)
    }
    setConfirmReset(false)
  }

  const toggleCollapse = path =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  // Viewed and collapsed are separate: marking viewed auto-collapses once, but
  // the file can be re-expanded via its chevron while staying viewed.
  const toggleReviewed = path => {
    const becomingReviewed = !reviewed.has(path)
    setReviewed(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (becomingReviewed) setCollapsed(prev => new Set(prev).add(path))
  }

  if (!repo) {
    return <p className="p-6 font-mono text-sm text-muted">{error ? `ReviewUI error: ${error}` : 'Loading…'}</p>
  }

  const treeEntries = files.map(file => ({
    path: filePath(file),
    type: file.type,
    ...fileStats(file),
    comments: comments.filter(c => c.filePath === filePath(file)).length,
    reviewed: reviewed.has(filePath(file))
  }))

  const paths = files.map(filePath)
  const allCollapsed = paths.length > 0 && paths.every(p => collapsed.has(p))
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(paths))

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

          <span className="text-xs text-muted tnum">
            {files.length} {files.length === 1 ? 'file' : 'files'}
            {reviewed.size > 0 && ` · ${reviewed.size}/${files.length} viewed`}
          </span>

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
                files.length === 0 ? 'No files to review' : allCollapsed ? 'Expand all files' : 'Collapse all files'
              }
            >
              <button
                onClick={toggleAll}
                disabled={files.length === 0}
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
              className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-accent to-accent-hover px-4 py-2 text-sm font-semibold text-on-accent shadow-sm ring-1 ring-inset ring-white/15 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
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
          <CommitBar commits={commits} view={view} mode={mode} onView={setView} onMode={setMode} />
        </div>
      </header>

      {error && (
        <p className="mx-4 mt-4 rounded-md border border-del/30 bg-del/10 px-3 py-2 font-mono text-xs text-del">
          {error}
        </p>
      )}

      <main className="mx-auto flex max-w-[1600px] items-start gap-5 p-4">
        <nav className="sticky top-28 max-h-[calc(100vh-8rem)] w-72 shrink-0 overflow-y-auto rounded-lg border border-line bg-panel p-2">
          <p className="eyebrow px-2 pb-2 pt-1">Changed files</p>
          <FileTree entries={treeEntries} onToggleReviewed={toggleReviewed} />
        </nav>
        <div className="min-w-0 flex-1">
          {files.map(file => (
            <FileDiff
              key={filePath(file)}
              file={file}
              viewType={viewType}
              comments={comments.filter(c => c.filePath === filePath(file))}
              collapsed={collapsed.has(filePath(file))}
              onToggleCollapse={() => toggleCollapse(filePath(file))}
              reviewed={reviewed.has(filePath(file))}
              onToggleReviewed={() => toggleReviewed(filePath(file))}
              onCreate={onCreateComment}
              onUpdate={onUpdateComment}
              onDelete={onDeleteComment}
            />
          ))}
          {files.length === 0 && (
            <div className="grid place-items-center rounded-lg border border-dashed border-line py-24 text-center">
              <p className="text-sm text-muted">No changes between these branches.</p>
              <p className="mt-1 font-mono text-xs text-faint">Pick a different base or compare branch.</p>
            </div>
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
