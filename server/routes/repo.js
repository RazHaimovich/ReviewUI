import { Router } from 'express'
import * as g from '../git.js'

export function repoRoutes(repoDir) {
  const router = Router()

  router.get('/repo', async (req, res, next) => {
    try {
      res.json(await g.repoInfo(repoDir))
    } catch (err) {
      next(err)
    }
  })

  return router
}
