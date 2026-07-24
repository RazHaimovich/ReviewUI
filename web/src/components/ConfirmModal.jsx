import clsx from 'clsx'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) {
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
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3 text-sm">
          <button onClick={onClose} className="rounded-md px-3 py-1 text-muted hover:bg-panel2 hover:text-ink">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              'rounded-md px-3 py-1 font-medium',
              danger ? 'bg-del text-white hover:opacity-90' : 'bg-accent text-on-accent hover:bg-accent-hover'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
