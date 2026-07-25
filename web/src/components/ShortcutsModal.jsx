const SHORTCUTS = [
  ['j / k', 'Next / previous file'],
  ['v', 'Mark the focused file viewed'],
  ['/', 'Filter files'],
  ['g', 'Generate the prompt'],
  ['?', 'This list'],
  ['Esc', 'Close a dialog, or leave the filter box']
]

export default function ShortcutsModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4">
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys} className="col-span-2 grid grid-cols-subgrid">
                <dt className="font-mono text-xs text-accent">{keys}</dt>
                <dd className="text-muted">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-faint">Comments are still started from the gutter with the mouse.</p>
        </div>
        <div className="flex justify-end border-t border-line px-4 py-3 text-sm">
          <button onClick={onClose} className="rounded-md px-3 py-1 text-muted hover:bg-panel2 hover:text-ink">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
