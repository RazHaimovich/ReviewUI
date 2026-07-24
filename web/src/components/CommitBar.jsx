import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Select from './Select.jsx';

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

  const commitOptions = [
    { value: 'final', label: `All ${commits.length} commits` },
    ...commits.map((c, i) => ({ value: c.sha, label: `${i + 1}. ${c.shortSha} · ${c.subject}` })),
  ];

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
          <ChevronLeftIcon className="size-3.5" />
        </NavButton>
        <Select
          ariaLabel="Select commit"
          value={view}
          onChange={onView}
          options={commitOptions}
          className="max-w-[26rem] rounded-md bg-panel2 px-2 py-1 font-mono text-xs text-ink hover:bg-line"
        />
        <NavButton disabled={index < 0 || index === commits.length - 1} onClick={() => onView(commits[index + 1].sha)}>
          <ChevronRightIcon className="size-3.5" />
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
