#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createApp } from './app.js'
import { isGitRepo } from './git.js'

const BASE_PORT = 41096
const MAX_ATTEMPTS = 20
const repoDir = process.cwd()

if (!(await isGitRepo(repoDir))) {
  console.error(`reviewui: not a git repository: ${repoDir}`)
  process.exit(1)
}

// Try BASE_PORT, then the next ports upward until one is free.
function listen(app, port, attemptsLeft) {
  const server = app.listen(port, '127.0.0.1')
  server.on('listening', () => onListening(port))
  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(app, port + 1, attemptsLeft - 1)
    } else if (err.code === 'EADDRINUSE') {
      console.error(
        `reviewui: no free port in ${BASE_PORT}-${BASE_PORT + MAX_ATTEMPTS} — is ReviewUI already running everywhere?`
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
