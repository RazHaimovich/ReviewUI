import { Router } from 'express'
import * as g from '../git.js'
import { buildPrompt } from '../prompt.js'

export function promptRoutes(repoDir, store) {
  const router = Router()

  router.post('/prompt', async (req, res, next) => {
    try {
      const { name } = await g.repoInfo(repoDir)
      const { base, head, summary } = req.body ?? {}
      const prompt = buildPrompt({ repoName: name, base, head, comments: store.list(), summary })
      console.log(`\n----- ReviewUI prompt -----\n${prompt}\n----- end prompt -----\n`)
      res.type('text/plain').send(prompt)
    } catch (err) {
      next(err)
    }
  })

  return router
}
