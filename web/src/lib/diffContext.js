// How many context lines a file's diff shows, cycled per file.
//
// `null` means "don't send a context argument at all", so the first request stays
// exactly what it was before this control existed and still honors a user's own
// diff.context config. 99999 stands in for the whole file.
export const CONTEXT_STEPS = [null, 20, 99999]

export function nextContext(current) {
  const i = CONTEXT_STEPS.indexOf(current)
  // An unrecognized value restarts the cycle rather than getting stuck.
  return CONTEXT_STEPS[(i + 1) % CONTEXT_STEPS.length]
}

export function contextLabel(context) {
  if (context === null) return '3'
  return context >= 99999 ? 'all' : String(context)
}
