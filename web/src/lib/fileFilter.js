// Narrows the changed-file list for the sidebar. Criteria are ANDed, so the text
// query composes with the two toggles.
//
// Entries are the tree's shape: { path, comments, reviewed, ... }.
export const NO_FILTER = { query: '', hideViewed: false, onlyCommented: false }

export function filterEntries(entries, filter = NO_FILTER) {
  const { query = '', hideViewed = false, onlyCommented = false } = filter
  const q = query.trim().toLowerCase()
  if (!q && !hideViewed && !onlyCommented) return entries
  return entries.filter(entry => {
    if (q && !entry.path.toLowerCase().includes(q)) return false
    if (hideViewed && entry.reviewed) return false
    if (onlyCommented && !entry.comments) return false
    return true
  })
}

// Whether anything is being hidden, so the UI can say "8 of 42" and tell an empty
// result apart from a branch with no changes.
export function isFiltering(filter = NO_FILTER) {
  const { query = '', hideViewed = false, onlyCommented = false } = filter
  return Boolean(query.trim()) || hideViewed || onlyCommented
}
