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
      // "Final result" means everything done on this branch, so when the
      // checked-out branch has uncommitted work the default view runs from the
      // fork point to the working tree. Resolved once, here, and rewritten into
      // the working-tree sentinel: the git layer then only ever branches on the
      // sentinel, and every command behind this one response describes the same
      // diff even if the tree changes underneath it.
      const includeWorktree = await g.finalIncludesWorktree(repoDir, req.query)
      const query = includeWorktree ? { ...req.query, commit: g.WORKTREE, mode: 'cumulative' } : req.query

      // Single-file request: return just that file's diff text.
      if (query.file) {
        return res.type('text/plain').send(await g.diff(repoDir, query))
      }
      // Default: the ordered file list (with an `oversized` flag) plus the diff
      // text for all but the long files, which the client fetches on demand.
      const stat = await g.diffStat(repoDir, query)
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
      const diff = await g.diff(repoDir, { ...query, exclude })
      // Tells the client whether what it is looking at includes uncommitted work,
      // whether it asked for that or got it from the default view.
      res.json({ diff, files, uncommitted: includeWorktree || req.query.commit === g.WORKTREE })
    } catch (err) {
      next(err)
    }
  })

  return router
}
