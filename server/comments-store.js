// In-memory comment store for a single review session (by design — see PRD).
// Shared by the comments and prompt routes.
export function createCommentsStore() {
  const comments = []
  let nextId = 1

  return {
    list() {
      return comments
    },
    add(data) {
      const comment = { included: true, ...data, id: nextId++ }
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
