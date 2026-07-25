import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCommentsStore } from './comments-store.js'
import { repoRoutes } from './routes/repo.js'
import { diffRoutes } from './routes/diff.js'
import { commentsRoutes } from './routes/comments.js'
import { promptRoutes } from './routes/prompt.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function createApp(repoDir, { defaultBase = null } = {}) {
  const app = express()
  app.use(express.json())

  // Reject non-local Host headers (DNS-rebinding protection).
  app.use((req, res, next) => {
    if (LOCAL_HOSTS.has(req.hostname)) return next()
    res.status(403).json({ error: 'forbidden host' })
  })

  const store = createCommentsStore()

  app.use('/api', repoRoutes(repoDir, defaultBase))
  app.use('/api', diffRoutes(repoDir))
  app.use('/api', commentsRoutes(store))
  app.use('/api', promptRoutes(repoDir, store))

  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist')
  app.use(express.static(dist))

  app.use((err, req, res, _next) => {
    res.status(err.status ?? 500).json({ error: String(err.stderr || err.message || err) })
  })

  return app
}
