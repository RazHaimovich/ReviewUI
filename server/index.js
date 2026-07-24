#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createApp } from './app.js'
import { git, isGitRepo } from './git.js'

// REVIEWUI_PORT overrides the starting port (kept in sync with the Vite dev proxy).
const BASE_PORT = Number(process.env.REVIEWUI_PORT) || 41096
const MAX_ATTEMPTS = 20
const cwd = process.cwd()

if (!(await isGitRepo(cwd))) {
  console.error(`reviewui: not a git repository: ${cwd}`)
  process.exit(1)
}

// Run all git commands from the repo root so file lists (whole-repo, root-relative)
// and per-file diffs use the same pathspecs even when launched in a subdirectory.
const repoDir = (await git(cwd, 'rev-parse', '--show-toplevel')).trim()

// Try BASE_PORT, then the next ports upward until one is free.
function listen(app, port, attemptsLeft) {
  const server = app.listen(port, '127.0.0.1')
  server.on('listening', () => onListening(port))
  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(app, port + 1, attemptsLeft - 1)
    } else if (err.code === 'EADDRINUSE') {
      console.error(
        `reviewui: no free port in ${BASE_PORT}-${BASE_PORT + MAX_ATTEMPTS} - is ReviewUI already running everywhere?`
      )
      process.exit(1)
    } else {
      throw err
    }
  })
}

function onListening(port) {
  const url = `http://localhost:${port}`
  console.log(`\n  ReviewUI running at ${url}  (Ctrl+C to quit)\n`)
  if (process.env.REVIEWUI_NO_OPEN) return
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]]
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
}

listen(createApp(repoDir), BASE_PORT, MAX_ATTEMPTS)
