import { useState } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  FloatingPortal,
} from '@floating-ui/react';

// Wraps children with a hover/focus tooltip. Pass an empty `label` to render
// children untouched (no wrapper) — used to show a reason only while disabled.
// Because disabled buttons don't emit pointer events, wrapped controls should
// carry `disabled:pointer-events-none` so the hover reaches this wrapper.
export default function Tooltip({ label, children, placement = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 6 })],
  });
  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  if (!label) return children;

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()} className="inline-flex cursor-not-allowed">
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 max-w-xs rounded-md border border-line bg-panel px-2 py-1 font-sans text-xs text-ink shadow-lg"
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
