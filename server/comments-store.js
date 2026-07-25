// How much a comment matters, so the prompt can tell the agent what blocks.
// must-fix is the default: it's what a review comment usually means, so marking
// something a question or a nit is the deliberate act.
export const SEVERITIES = ['must-fix', 'question', 'nit']
export const DEFAULT_SEVERITY = 'must-fix'

// In-memory comment store for a single review session (by design - see PRD).
// Shared by the comments and prompt routes.
export function createCommentsStore() {
  const comments = []
  let nextId = 1

  return {
    list() {
      return comments
    },
    add(data) {
      // Defaults ahead of the spread so every creation path agrees on them.
      const comment = { included: true, severity: DEFAULT_SEVERITY, ...data, id: nextId++ }
      comments.push(comment)
      return comment
    },
    find(id) {
      return comments.find(c => c.id === Number(id))
    },
    remove(id) {
      const index = comments.findIndex(c => c.id === Number(id))
      if (index === -1) return false
      comments.splice(index, 1)
      return true
    }
  }
}
