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
      // Default: the ordered file list (with an `oversized` flag) plus the diff
      // text for all but the long files, which the client fetches on demand.
      const stat = await g.diffStat(repoDir, req.query)
      const files = stat.map(f => ({
        path: f.path,
        adds: f.adds,
        dels: f.dels,
        binary: f.binary,
        type: f.type,
        oversized: !f.binary && f.adds + f.dels > LONG_FILE_LINES
      }))
      // Binary files have no useful text diff; skip them (and long files) here.
      const exclude = files.filter(f => f.oversized || f.binary).map(f => f.path)
      const diff = await g.diff(repoDir, { ...req.query, exclude })
      res.json({ diff, files })
    } catch (err) {
      next(err)
    }
  })

  return router
}
