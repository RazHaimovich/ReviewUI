#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createApp } from './app.js';
import { isGitRepo } from './git.js';

const PORT = 41096;
const repoDir = process.cwd();

if (!(await isGitRepo(repoDir))) {
  console.error(`reviewui: not a git repository: ${repoDir}`);
  process.exit(1);
}

const server = createApp(repoDir).listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`ReviewUI running at ${url} (Ctrl+C to quit)`);
  if (process.env.REVIEWUI_NO_OPEN) return;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`reviewui: port ${PORT} is already in use — is another ReviewUI running?`);
    process.exit(1);
  }
  throw err;
});
