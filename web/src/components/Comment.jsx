import { useState } from 'react'
import clsx from 'clsx'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import ConfirmModal from './ConfirmModal.jsx'

// Kept in step with SEVERITIES in server/comments-store.js. must-fix is the
// default, so downgrading is the deliberate act.
const SEVERITY = {
  'must-fix': { label: 'Must fix', chip: 'bg-del/15 text-del' },
  question: { label: 'Question', chip: 'bg-accent-soft text-accent' },
  nit: { label: 'Nit', chip: 'bg-panel2 text-muted' }
}
const SEVERITY_ORDER = ['must-fix', 'question', 'nit']

export function CommentForm({
  initial = '',
  initialSeverity = 'must-fix',
  onSave,
  onCancel,
  placeholder = 'Leave a comment…  (drag across line numbers to select a range)'
}) {
  const [body, setBody] = useState(initial)
  const [severity, setSeverity] = useState(initialSeverity)
  return (
    <div className="bg-accent-soft/60 p-2.5 font-sans">
      <textarea
        autoFocus
        rows={3}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-md border border-line-strong bg-panel p-2 text-sm text-ink placeholder:text-faint"
      />
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="flex items-center rounded-md bg-panel2 p-0.5" role="group" aria-label="Severity">
          {SEVERITY_ORDER.map(value => (
            <button
              key={value}
              onClick={() => setSeverity(value)}
              aria-pressed={severity === value}
              className={clsx(
                'rounded px-2 py-0.5 text-xs',
                severity === value ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              {SEVERITY[value].label}
            </button>
          ))}
        </span>
        <span className="grow" />
        <button onClick={onCancel} className="rounded-md px-3 py-1 text-muted hover:bg-panel2 hover:text-ink">
          Cancel
        </button>
        <button
          disabled={!body.trim()}
          onClick={() => onSave(body.trim(), severity)}
          className="rounded-md bg-accent px-3 py-1 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

export function CommentCard({ comment, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const range =
    comment.scope === 'file'
      ? 'whole file'
      : comment.endLine && comment.endLine !== comment.startLine
        ? `L${comment.startLine}–${comment.endLine}`
        : `L${comment.startLine}`

  if (editing) {
    return (
      <CommentForm
        initial={comment.body}
        initialSeverity={comment.severity ?? 'must-fix'}
        onCancel={() => setEditing(false)}
        onSave={(body, severity) => {
          onUpdate(comment.id, { body, severity })
          setEditing(false)
        }}
      />
    )
  }

  const excluded = comment.included === false
  const iconBtn = 'grid size-6 place-items-center rounded text-muted hover:bg-panel2 hover:text-ink'

  return (
    <div className="px-3 py-2.5 font-sans text-sm">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[0.6875rem] tracking-wide text-accent tnum">{range}</span>
        <span
          className={clsx(
            'rounded px-1.5 text-[0.6875rem] font-medium',
            (SEVERITY[comment.severity] ?? SEVERITY['must-fix']).chip
          )}
        >
          {(SEVERITY[comment.severity] ?? SEVERITY['must-fix']).label}
        </span>
        {/* The working tree has no id, so it is named rather than abbreviated. */}
        {comment.commitSha === 'worktree' ? (
          <span className="rounded bg-panel2 px-1.5 font-mono text-[0.6875rem] text-muted">uncommitted</span>
        ) : (
          comment.commitSha && (
            <span className="rounded bg-panel2 px-1.5 font-mono text-[0.6875rem] text-muted">
              @{comment.commitSha.slice(0, 7)}
            </span>
          )
        )}
        <span className="grow" />
        <label
          title="Whether this comment is sent in the generated prompt"
          className={clsx(
            'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem]',
            excluded ? 'border-line text-muted' : 'border-accent bg-accent-soft text-accent'
          )}
        >
          <input
            type="checkbox"
            checked={!excluded}
            onChange={() => onUpdate(comment.id, { included: excluded })}
            className="accent-accent"
          />
          In prompt
        </label>
        <button title="Edit" onClick={() => setEditing(true)} className={iconBtn}>
          <PencilIcon className="size-3.5" />
        </button>
        <button title="Delete" onClick={() => setConfirmDelete(true)} className={clsx(iconBtn, 'hover:text-del')}>
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
      <p className={clsx('whitespace-pre-wrap', excluded ? 'text-muted line-through' : 'text-ink')}>{comment.body}</p>
      {confirmDelete && (
        <ConfirmModal
          title="Delete comment?"
          message="This removes the comment from your review."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            onDelete(comment.id)
            setConfirmDelete(false)
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
