import { Router } from 'express';

export function commentsRoutes(store) {
  const router = Router();

  router.get('/comments', (req, res) => res.json(store.list()));

  router.post('/comments', (req, res) => {
    const { filePath, body, startLine } = req.body ?? {};
    if (!filePath || !body?.trim() || !Number.isInteger(startLine)) {
      return res.status(400).json({ error: 'filePath, body and startLine are required' });
    }
    res.status(201).json(store.add(req.body));
  });

  router.patch('/comments/:id', (req, res) => {
    const comment = store.find(req.params.id);
    if (!comment) return res.status(404).json({ error: 'no such comment' });
    const { body, included } = req.body ?? {};
    if (body !== undefined) {
      if (!body.trim()) return res.status(400).json({ error: 'body cannot be empty' });
      comment.body = body;
    }
    if (included !== undefined) comment.included = Boolean(included);
    res.json(comment);
  });

  router.delete('/comments/:id', (req, res) => {
    if (!store.remove(req.params.id)) return res.status(404).json({ error: 'no such comment' });
    res.json({ ok: true });
  });

  return router;
}
