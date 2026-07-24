import clsx from 'clsx'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Select from './Select.jsx'
import Tooltip from './Tooltip.jsx'

function NavButton({ active, children, ...props }) {
  return (
    <button
      className={clsx(
        'flex items-center gap-0.5 rounded-md px-2 py-1 text-xs disabled:pointer-events-none disabled:opacity-40',
        active ? 'bg-accent-soft font-medium text-accent' : 'bg-panel2 text-muted hover:text-ink'
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export default function CommitBar({ commits, view, mode, onView, onMode }) {
  const index = commits.findIndex(c => c.sha === view)
  const selected = index >= 0 ? commits[index] : null

  const commitOptions = [
    { value: 'final', label: `All ${commits.length} commits` },
    ...commits.map((c, i) => ({ value: c.sha, label: `${i + 1}. ${c.shortSha} · ${c.subject}` }))
  ]

  const date = selected.date ? new Date(selected.date) : null
  const formattedDate = date
    ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(
        '-'
      )
    : null

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <NavButton active={view === 'final'} onClick={() => onView('final')}>
        Final result
      </NavButton>

      <div className="flex items-center gap-1">
        <Tooltip label={commits.length === 0 || index === 0 ? 'No older commit' : 'Older commit'}>
          <NavButton
            disabled={commits.length === 0 || index === 0}
            onClick={() => onView(commits[index < 0 ? commits.length - 1 : index - 1].sha)}
          >
            <ChevronLeftIcon className="size-3.5" />
          </NavButton>
        </Tooltip>
        <Select
          ariaLabel="Select commit"
          value={view}
          onChange={onView}
          options={commitOptions}
          className="max-w-104 rounded-md bg-panel2 px-2 py-1 font-mono text-xs text-ink hover:bg-line"
        />
        <Tooltip label={index < 0 || index === commits.length - 1 ? 'No newer commit' : 'Newer commit'}>
          <NavButton
            disabled={index < 0 || index === commits.length - 1}
            onClick={() => onView(commits[index + 1].sha)}
          >
            <ChevronRightIcon className="size-3.5" />
          </NavButton>
        </Tooltip>
      </div>

      {selected && (
        <>
          <span className="flex items-center rounded-md bg-panel2 p-0.5">
            {[
              ['single', 'This commit'],
              ['cumulative', 'Cumulative']
            ].map(([m, label]) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                className={clsx(
                  'rounded px-2 py-0.5 text-xs',
                  mode === m ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </span>
          <span className="truncate font-mono text-xs text-faint">
            {selected.author}
            {formattedDate ? ` · ${formattedDate}` : ''}
          </span>
        </>
      )}
    </div>
  )
}
