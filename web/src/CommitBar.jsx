function NavButton({ children, ...props }) {
  return (
    <button
      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white"
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
      <NavButton
        onClick={() => onView('final')}
        style={view === 'final' ? { fontWeight: 600, borderColor: '#111' } : undefined}
      >
        Final result
      </NavButton>
      <NavButton disabled={commits.length === 0 || index === 0} onClick={() => onView(commits[index < 0 ? commits.length - 1 : index - 1].sha)}>
        ← Older
      </NavButton>
      <select
        className="max-w-96 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs"
        value={view}
        onChange={(e) => onView(e.target.value)}
      >
        <option value="final">All commits ({commits.length})</option>
        {commits.map((c, i) => (
          <option key={c.sha} value={c.sha}>
            {i + 1}. {c.shortSha} {c.subject}
          </option>
        ))}
      </select>
      <NavButton disabled={index < 0 || index === commits.length - 1} onClick={() => onView(commits[index + 1].sha)}>
        Newer →
      </NavButton>
      {selected && (
        <>
          <span className="inline-flex overflow-hidden rounded border border-gray-300 text-xs">
            {['single', 'cumulative'].map((m) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                className={`px-2 py-0.5 ${mode === m ? 'bg-gray-800 text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {m === 'single' ? 'This commit' : 'Cumulative'}
              </button>
            ))}
          </span>
          <span className="truncate text-xs text-gray-500">
            {selected.author} · {new Date(selected.date).toLocaleString()}
          </span>
        </>
      )}
    </div>
  );
}
