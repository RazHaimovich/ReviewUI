import { Router } from 'express'
import * as g from '../git.js'

// `defaultBase` (from --base) overrides the detected main/master. It is also
// added to the branch list when it isn't already one, so `--base v1.0.0` still
// gives the branch picker something to show.
export function repoRoutes(repoDir, defaultBase = null) {
  const router = Router()

  router.get('/repo', async (req, res, next) => {
    try {
      const info = await g.repoInfo(repoDir)
      if (!defaultBase) return res.json(info)
      const branches = info.branches.includes(defaultBase) ? info.branches : [...info.branches, defaultBase]
      res.json({ ...info, branches, defaultBase })
    } catch (err) {
      next(err)
    }
  })

  return router
}
