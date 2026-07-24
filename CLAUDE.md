# CLAUDE.md

Guidance for working in this repository.

## What ReviewUI is

A zero-install CLI: run `npx reviewui` inside any git repo to open a local,
GitHub-style code-review UI on **port 41096**. You browse the diff of your
current branch against `main`/`master`, leave comments on lines or ranges, and
generate a single prompt (copied to the clipboard and printed to the terminal)
to paste into Claude Code.

## Commands

```sh
npm install          # install deps (build-time libs are devDependencies)
npm run build        # build the web UI into web/dist (required before running)
npm test             # node:test suite (HTTP API + pure helpers)
npm run lint         # ESLint (flat config)
npm run format       # Prettier write   (format:check verifies in CI)
npm run spell        # cspell
node server/index.js # run from inside any git repo (serves web/dist)
npm run dev:web      # Vite dev server with hot reload, proxies /api to :41096
```

CI (`.github/workflows/ci.yml`) runs lint, format:check, spell, test, and build
on every PR. The port auto-increments from 41096 if busy.

For development: run `node server/index.js` and `npm run dev:web` in two
terminals. Set `REVIEWUI_NO_OPEN=1` to skip auto-opening the browser.
The server serves the built `web/dist`, not live source - rebuild after UI edits.
The Vite dev proxy targets `REVIEWUI_PORT` (default 41096); if 41096 is busy,
set the same `REVIEWUI_PORT` for both commands so the proxy matches the backend.

## Architecture

- **`server/`** - Node/Express. `index.js` is the CLI entry (validates git repo,
  binds 41096, opens browser). `app.js` defines the JSON API. `git.js` runs all
  git via `execFile` in the invocation directory. `prompt.js` assembles the
  Claude Code prompt. Comments live in memory for one session.
- **`web/`** - React + Vite + Tailwind v4 app, built to `web/dist`. Source under
  `web/src`: `main.jsx` + `index.css` at the root, React components in
  `components/`, and non-UI helpers (`api`, `lineRange`, `highlight`) in `lib/`.
  Diffs render via `react-diff-view`; syntax highlighting via `refractor`.
- **`test/`** - `node:test` against a throwaway fixture git repo (`fixture.js`)
  plus pure-helper unit tests.

## Conventions

- **Styling**: Tailwind v4 with a CSS-variable token system in
  `web/src/index.css` (`--c-*` flip on `.dark`, exposed as `bg-panel`,
  `text-ink`, `text-accent`, etc. via `@theme inline`). Style through the
  tokens; avoid raw `dark:` variants. `@custom-variant`/`@theme` are valid
  Tailwind at-rules - the editor lint for them is disabled in `.vscode/`.
- **Icons**: import lucide icons by their `…Icon`-suffixed alias
  (`ChevronDownIcon`, not `ChevronDown`).
- **Comments UX**: gutter-only. Hovering a line number shows a "+"; clicking the
  number cell starts a single-line comment; dragging across numbers selects a
  range. Clicking code text never starts a comment.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`,
  `docs:`).
- **Punctuation**: never use an em dash (`—`) in code, comments, UI copy, or
  docs. Use a plain hyphen (`-`) instead.

## Security constraints (do not regress)

Established in the 0.1.0 review - keep these intact:

- Git refs from the client are rejected if empty or flag-like (`-…`) to prevent
  argument injection into `git` (`assertRef` in `git.js`).
- The server binds to `127.0.0.1` only.
- Requests with a non-local `Host` header are rejected (403) to block DNS
  rebinding.
- The tool never writes into the repository being reviewed; its only outputs are
  the browser UI, stdout, and the clipboard.
