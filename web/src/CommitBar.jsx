import { ChevronLeft, ChevronRight } from 'lucide-react';

function NavButton({ active, children, ...props }) {
  return (
    <button
      className={`flex items-center gap-0.5 rounded-md px-2 py-1 text-xs disabled:opacity-40 ${
        active
          ? 'bg-accent-soft font-medium text-accent'
          : 'bg-panel2 text-muted hover:text-ink disabled:hover:text-muted'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function CommitBar({ commits, view, mode, onView, onMode }) {
  const index = commits.findIndex((c) => c.sha === view);
  const selected = index >= 0 ? commits[index] : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <NavButton active={view === 'final'} onClick={() => onView('final')}>
        Final result
      </NavButton>

      <div className="flex items-center gap-1">
        <NavButton
          disabled={commits.length === 0 || index === 0}
          onClick={() => onView(commits[index < 0 ? commits.length - 1 : index - 1].sha)}
        >
          <ChevronLeft className="size-3.5" />
        </NavButton>
        <select
          className="max-w-[26rem] rounded-md bg-panel2 px-2 py-1 font-mono text-xs text-ink hover:bg-line"
          value={view}
          onChange={(e) => onView(e.target.value)}
        >
          <option value="final">All {commits.length} commits</option>
          {commits.map((c, i) => (
            <option key={c.sha} value={c.sha}>
              {i + 1}. {c.shortSha} · {c.subject}
            </option>
          ))}
        </select>
        <NavButton disabled={index < 0 || index === commits.length - 1} onClick={() => onView(commits[index + 1].sha)}>
          <ChevronRight className="size-3.5" />
        </NavButton>
      </div>

      {selected && (
        <>
          <span className="flex items-center rounded-md bg-panel2 p-0.5">
            {[
              ['single', 'This commit'],
              ['cumulative', 'Cumulative'],
            ].map(([m, label]) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                className={`rounded px-2 py-0.5 text-xs ${
                  mode === m ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </span>
          <span className="truncate font-mono text-xs text-faint">
            {selected.author} · {new Date(selected.date).toLocaleDateString()}
          </span>
        </>
      )}
    </div>
  );
}
