import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as g from './git.js';

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

  api.get('/diff', async (req, res, next) => {
    try {
      res.type('text/plain').send(await g.diff(repoDir, req.query));
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
