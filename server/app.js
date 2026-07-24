import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as g from './git.js';
import { buildPrompt } from './prompt.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function createApp(repoDir) {
  const app = express();
  app.use(express.json());

  // Reject non-local Host headers (DNS-rebinding protection).
  app.use((req, res, next) => {
    if (LOCAL_HOSTS.has(req.hostname)) return next();
    res.status(403).json({ error: 'forbidden host' });
  });

  const api = express.Router();

  api.get('/repo', async (req, res, next) => {
    try {
      res.json(await g.repoInfo(repoDir));
    } catch (err) {
      next(err);
    }
  });

  api.get('/commits', async (req, res, next) => {
    try {
      res.json(await g.commits(repoDir, req.query.base, req.query.head));
    } catch (err) {
      next(err);
    }
  });

  api.get('/diff', async (req, res, next) => {
    try {
      res.type('text/plain').send(await g.diff(repoDir, req.query));
    } catch (err) {
      next(err);
    }
  });

  // ponytail: in-memory, single-session comment store by design (see PRD)
  const comments = [];
  let nextId = 1;

  api.get('/comments', (req, res) => res.json(comments));

  api.post('/comments', (req, res) => {
    const { filePath, body, startLine } = req.body ?? {};
    if (!filePath || !body?.trim() || !Number.isInteger(startLine)) {
      return res.status(400).json({ error: 'filePath, body and startLine are required' });
    }
    const comment = { included: true, ...req.body, id: nextId++ };
    comments.push(comment);
    res.status(201).json(comment);
  });

  api.patch('/comments/:id', (req, res) => {
    const comment = comments.find((c) => c.id === Number(req.params.id));
    if (!comment) return res.status(404).json({ error: 'no such comment' });
    const { body, included } = req.body ?? {};
    if (body !== undefined) {
      if (!body.trim()) return res.status(400).json({ error: 'body cannot be empty' });
      comment.body = body;
    }
    if (included !== undefined) comment.included = Boolean(included);
    res.json(comment);
  });

  api.delete('/comments/:id', (req, res) => {
    const index = comments.findIndex((c) => c.id === Number(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'no such comment' });
    comments.splice(index, 1);
    res.json({ ok: true });
  });

  api.post('/prompt', async (req, res, next) => {
    try {
      const { name } = await g.repoInfo(repoDir);
      const { base, head, summary } = req.body ?? {};
      const prompt = buildPrompt({ repoName: name, base, head, comments, summary });
      console.log(`\n----- ReviewUI prompt -----\n${prompt}\n----- end prompt -----\n`);
      res.type('text/plain').send(prompt);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', api);

  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
  app.use(express.static(dist));

  app.use((err, req, res, next) => {
    res.status(err.status ?? 500).json({ error: String(err.stderr || err.message || err) });
  });

  return app;
}
