import { Router } from 'express'
import { SEVERITIES } from '../comments-store.js'

// Absent is fine (the store applies the default); anything outside the set is not.
function badSeverity(severity) {
  return severity !== undefined && !SEVERITIES.includes(severity)
}

export function commentsRoutes(store) {
  const router = Router()

  router.get('/comments', (req, res) => res.json(store.list()))

  router.post('/comments', (req, res) => {
    const { filePath, body, startLine, scope, severity } = req.body ?? {}
    if (!filePath || !body?.trim()) {
      return res.status(400).json({ error: 'filePath and body are required' })
    }
    // Line comments need a line; whole-file comments (scope: 'file') do not.
    if (scope !== 'file' && !Number.isInteger(startLine)) {
      return res.status(400).json({ error: 'startLine is required for line comments' })
    }
    if (badSeverity(severity)) {
      return res.status(400).json({ error: `severity must be one of: ${SEVERITIES.join(', ')}` })
    }
    res.status(201).json(store.add(req.body))
  })

  router.patch('/comments/:id', (req, res) => {
    const comment = store.find(req.params.id)
    if (!comment) return res.status(404).json({ error: 'no such comment' })
    const { body, included, severity } = req.body ?? {}
    if (badSeverity(severity)) {
      return res.status(400).json({ error: `severity must be one of: ${SEVERITIES.join(', ')}` })
    }
    if (body !== undefined) {
      if (!body.trim()) return res.status(400).json({ error: 'body cannot be empty' })
      comment.body = body
    }
    if (included !== undefined) comment.included = Boolean(included)
    if (severity !== undefined) comment.severity = severity
    res.json(comment)
  })

  router.delete('/comments/:id', (req, res) => {
    if (!store.remove(req.params.id)) return res.status(404).json({ error: 'no such comment' })
    res.json({ ok: true })
  })

  return router
}
