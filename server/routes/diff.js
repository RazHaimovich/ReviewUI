import { Router } from 'express'
import * as g from '../git.js'

// Files with more than this many changed lines are omitted from the default
// response and fetched on demand (?file=...).
const LONG_FILE_LINES = 800

export function diffRoutes(repoDir) {
  const router = Router()

  router.get('/commits', async (req, res, next) => {
    try {
      res.json(await g.commits(repoDir, req.query.base, req.query.head))
    } catch (err) {
      next(err)
    }
  })

  router.get('/diff', async (req, res, next) => {
    try {
      // Single-file request: return just that file's diff text.
      if (req.query.file) {
        return res.type('text/plain').send(await g.diff(repoDir, req.query))
      }
      // Default: omit long files, list them so the client can fetch on demand.
      const stat = await g.diffStat(repoDir, req.query)
      const oversized = stat.filter(f => !f.binary && f.adds + f.dels > LONG_FILE_LINES)
      const diff = await g.diff(repoDir, { ...req.query, exclude: oversized.map(f => f.path) })
      res.json({ diff, oversized })
    } catch (err) {
      next(err)
    }
  })

  return router
}
