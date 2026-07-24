import { useRef, useState } from 'react'
import clsx from 'clsx'
import {
  autoUpdate,
  flip,
  offset,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead,
  FloatingFocusManager,
  FloatingPortal
} from '@floating-ui/react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

// Accessible, styled replacement for a native <select>.
// options: [{ value, label }]. label is a string (used for display + typeahead).
export default function Select({ value, onChange, options, className = '', ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(null)
  const selectedIndex = options.findIndex(o => o.value === value)

  const listRef = useRef([])
  const labelsRef = useRef(options.map(o => o.label))
  labelsRef.current = options.map(o => o.label)

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight, 340)}px`
          })
        }
      })
    ]
  })

  const click = useClick(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'listbox' })
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    selectedIndex: selectedIndex < 0 ? null : selectedIndex,
    onNavigate: setActiveIndex,
    loop: true
  })
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex: selectedIndex < 0 ? null : selectedIndex,
    onMatch: open ? setActiveIndex : undefined
  })
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    listNav,
    typeahead
  ])

  const selected = options[selectedIndex]

  function select(index) {
    onChange(options[index].value)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        aria-label={ariaLabel}
        className={clsx('flex items-center gap-1.5', className)}
        {...getReferenceProps()}
      >
        <span className="truncate">{selected ? selected.label : ''}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="z-50 overflow-y-auto overscroll-contain rounded-lg border border-line bg-panel p-1 shadow-xl"
              {...getFloatingProps()}
            >
              {options.map((opt, i) => (
                <div
                  key={opt.value}
                  ref={node => {
                    listRef.current[i] = node
                  }}
                  role="option"
                  aria-selected={i === selectedIndex}
                  tabIndex={i === activeIndex ? 0 : -1}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs outline-none',
                    i === activeIndex ? 'bg-accent-soft text-accent' : 'text-ink'
                  )}
                  {...getItemProps({
                    onClick: () => select(i),
                    onKeyDown: event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        select(i)
                      }
                    }
                  })}
                >
                  <CheckIcon
                    className={clsx('size-3.5 shrink-0 text-accent', i === selectedIndex ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{opt.label}</span>
                </div>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
