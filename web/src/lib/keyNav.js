// Which file a j/k keypress should move to.
//
// Stops at both ends rather than wrapping, so holding a key doesn't silently
// loop back to the top of a long branch. With nothing focused (or a focus that
// has been filtered out of the list) it enters from the nearest end.
export function nextPath(paths, current, delta) {
  if (paths.length === 0) return null
  const i = paths.indexOf(current)
  if (i === -1) return delta > 0 ? paths[0] : paths[paths.length - 1]
  const next = i + delta
  return next < 0 || next >= paths.length ? paths[i] : paths[next]
}

// True when a keystroke landed in something the user is typing into, so
// navigation keys stay out of the way of writing a comment.
export function isTypingTarget(el) {
  if (!el) return false
  return Boolean(el.isContentEditable) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}
