import { Router } from 'express'
import * as g from '../git.js'

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
      res.type('text/plain').send(await g.diff(repoDir, req.query))
    } catch (err) {
      next(err)
    }
  })

  return router
}
