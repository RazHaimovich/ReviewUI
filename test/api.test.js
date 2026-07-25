import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { createApp } from '../server/app.js'
import { makeFixtureRepo } from './fixture.js'

const fixture = makeFixtureRepo()
const server = createApp(fixture.dir).listen(0)
const base = `http://localhost:${server.address().port}`
test.after(() => server.close())

test('GET /api/repo reports branches, current branch and default base', async () => {
  const res = await fetch(`${base}/api/repo`)
  assert.equal(res.status, 200)
  const repo = await res.json()
  assert.deepEqual(repo.branches.sort(), ['feature', 'main'])
  assert.equal(repo.current, 'feature')
  assert.equal(repo.defaultBase, 'main')
  assert.ok(repo.name)
})

test('GET /api/diff returns the three-dot diff and an ordered file list', async () => {
  const res = await fetch(`${base}/api/diff?base=main&head=feature`)
  assert.equal(res.status, 200)
  const { diff, files } = await res.json()
  assert.equal(diff, fixture.git('diff', 'main...feature'))
  assert.match(diff, /hello \$\{name\}/)
  assert.match(diff, /src\/bye\.js/)
  assert.deepEqual(files.map(f => f.path).sort(), ['hello.js', 'src/bye.js'])
  assert.ok(files.every(f => f.oversized === false)) // fixture files are all small
})

test('GET /api/diff?file= returns just that file diff', async () => {
  const res = await fetch(`${base}/api/diff?base=main&head=feature&file=hello.js`)
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.equal(body, fixture.git('diff', 'main...feature', '--', 'hello.js'))
  assert.match(body, /hello \$\{name\}/)
  assert.doesNotMatch(body, /bye\.js/)
})

test('GET /api/commits lists branch commits oldest-first', async () => {
  const res = await fetch(`${base}/api/commits?base=main&head=feature`)
  assert.equal(res.status, 200)
  const commits = await res.json()
  assert.deepEqual(
    commits.map(c => c.subject),
    ['greet takes a name', 'add bye']
  )
  for (const c of commits) {
    assert.match(c.sha, /^[0-9a-f]{40}$/)
    assert.ok(c.shortSha && c.author && c.date)
  }
})

test('single-commit diff matches git show', async () => {
  const commits = await (await fetch(`${base}/api/commits?base=main&head=feature`)).json()
  const first = commits[0].sha
  const res = await fetch(`${base}/api/diff?base=main&head=feature&commit=${first}&mode=single`)
  const { diff } = await res.json()
  assert.equal(diff, fixture.git('show', '--format=', '--patch', first))
  assert.match(diff, /hello \$\{name\}/)
  assert.doesNotMatch(diff, /bye\.js/)
})

test('cumulative diff matches git diff from merge-base', async () => {
  const commits = await (await fetch(`${base}/api/commits?base=main&head=feature`)).json()
  const second = commits[1].sha
  const res = await fetch(`${base}/api/diff?base=main&head=feature&commit=${second}&mode=cumulative`)
  const { diff } = await res.json()
  const mergeBase = fixture.git('merge-base', 'main', 'feature').trim()
  assert.equal(diff, fixture.git('diff', `${mergeBase}..${second}`))
  assert.match(diff, /hello \$\{name\}/)
  assert.match(diff, /bye\.js/)
})

test('refs that look like git flags are rejected with 400', async () => {
  const res = await fetch(`${base}/api/diff?base=--output=/tmp/pwned&head=feature`)
  assert.equal(res.status, 400)
})

test('non-local Host headers are rejected (DNS rebinding)', async () => {
  // fetch() refuses to override Host, so use the raw http client.
  const status = await new Promise((resolve, reject) => {
    http
      .get(`${base}/api/repo`, { headers: { Host: 'evil.example.com' } }, res => {
        res.resume()
        resolve(res.statusCode)
      })
      .on('error', reject)
  })
  assert.equal(status, 403)
})

test('comments round-trip into the generated prompt', async () => {
  const post = payload =>
    fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })

  const created = await post({
    filePath: 'hello.js',
    side: 'new',
    startLine: 1,
    endLine: 1,
    snippet: '+export const greet = (name) => `hello ${name}`;',
    body: 'Use a default value for name',
    commitSha: null
  })
  assert.equal(created.status, 201)
  const { id } = await created.json()

  await post({
    filePath: 'src/bye.js',
    side: 'new',
    startLine: 1,
    endLine: 1,
    snippet: '+export const bye = () => "bye";',
    body: 'Add a test for bye',
    commitSha: 'abcdef1234567890'
  })

  const listed = await (await fetch(`${base}/api/comments`)).json()
  assert.equal(listed.length, 2)

  const promptRes = await fetch(`${base}/api/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base: 'main', head: 'feature' })
  })
  assert.equal(promptRes.status, 200)
  const prompt = await promptRes.text()
  assert.match(prompt, /## 1\. hello\.js:1/)
  assert.match(prompt, /Use a default value for name/)
  assert.match(prompt, /hello \$\{name\}/)
  assert.match(prompt, /## 2\. src\/bye\.js:1 \(commented on commit abcdef1\)/)
  assert.match(prompt, /locate the referenced snippet/)

  // delete removes from store and from the next prompt
  assert.equal((await fetch(`${base}/api/comments/${id}`, { method: 'DELETE' })).status, 200)
  const after = await (
    await fetch(`${base}/api/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base: 'main', head: 'feature' })
    })
  ).text()
  assert.doesNotMatch(after, /hello\.js:1/)
  assert.match(after, /## 1\. src\/bye\.js:1/)

  // invalid comment payloads are rejected
  assert.equal((await post({ body: 'no file' })).status, 400)
})

test('edit, exclude and summary shape the prompt', async () => {
  const post = payload =>
    fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json())
  const patch = (id, payload) =>
    fetch(`${base}/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
  const prompt = () =>
    fetch(`${base}/api/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base: 'main', head: 'feature', summary: 'Prefer smaller functions.' })
    }).then(r => r.text())

  // start from an empty store regardless of earlier tests
  for (const c of await (await fetch(`${base}/api/comments`)).json()) {
    await fetch(`${base}/api/comments/${c.id}`, { method: 'DELETE' })
  }

  const a = await post({ filePath: 'hello.js', startLine: 1, endLine: 3, snippet: 's', body: 'first' })
  const b = await post({ filePath: 'src/bye.js', startLine: 1, endLine: 1, snippet: 's', body: 'second' })

  // edit body
  const edited = await patch(a.id, { body: 'first (edited)' })
  assert.equal(edited.status, 200)

  // multi-line range renders as start-end; summary section present
  let text = await prompt()
  assert.match(text, /## 1\. hello\.js:1-3/)
  assert.match(text, /first \(edited\)/)
  assert.match(text, /## Overall\n\nPrefer smaller functions\./)

  // excluded comments disappear and numbering shifts
  await patch(a.id, { included: false })
  text = await prompt()
  assert.doesNotMatch(text, /hello\.js:1-3/)
  assert.match(text, /## 1\. src\/bye\.js:1/)

  // re-include restores it
  await patch(a.id, { included: true })
  text = await prompt()
  assert.match(text, /## 1\. hello\.js:1-3/)

  // guards
  assert.equal((await patch(a.id, { body: '  ' })).status, 400)
  assert.equal((await patch(9999, { body: 'x' })).status, 404)

  // cleanup for other tests
  await fetch(`${base}/api/comments/${a.id}`, { method: 'DELETE' })
  await fetch(`${base}/api/comments/${b.id}`, { method: 'DELETE' })
})

test('a whole-file comment needs no line and renders as (whole file) in the prompt', async () => {
  const post = payload =>
    fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })

  // clear any existing comments
  for (const c of await (await fetch(`${base}/api/comments`)).json()) {
    await fetch(`${base}/api/comments/${c.id}`, { method: 'DELETE' })
  }

  // file-scoped comment: no startLine required
  const created = await post({ filePath: 'hello.js', scope: 'file', body: 'This module needs tests' })
  assert.equal(created.status, 201)

  // a line comment still requires a line
  assert.equal((await post({ filePath: 'hello.js', body: 'no line' })).status, 400)

  const prompt = await (
    await fetch(`${base}/api/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base: 'main', head: 'feature' })
    })
  ).text()
  assert.match(prompt, /## 1\. hello\.js \(whole file\)/)
  assert.match(prompt, /This module needs tests/)

  for (const c of await (await fetch(`${base}/api/comments`)).json()) {
    await fetch(`${base}/api/comments/${c.id}`, { method: 'DELETE' })
  }
})

test('renames, binary files and non-ASCII paths resolve; per-commit lists are non-empty', async () => {
  const fx = makeFixtureRepo()
  // One commit on feature: a rename, a binary file, and a spaced non-ASCII path.
  fx.git('mv', 'src/bye.js', 'src/farewell.js')
  writeFileSync(path.join(fx.dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 254, 0]))
  writeFileSync(path.join(fx.dir, 'café menu.txt'), 'a coffee\n')
  fx.git('add', '-A')
  fx.git('commit', '-m', 'rename and add assets')

  const srv = createApp(fx.dir).listen(0)
  const b = `http://localhost:${srv.address().port}`
  try {
    const { files } = await (await fetch(`${b}/api/diff?base=main&head=feature`)).json()
    const byPath = Object.fromEntries(files.map(f => [f.path, f]))

    // binary file is flagged
    assert.equal(byPath['logo.png'].binary, true)

    // non-ASCII + space path is unquoted, so it matches gitdiff-parser's newPath
    assert.ok(byPath['café menu.txt'], 'non-ASCII path unquoted')

    // The rename is only a rename within its own commit (bye.js never existed on
    // main). The per-commit list must be non-empty (regression: --no-patch) and
    // key the rename by its NEW path with type 'rename'.
    const commits = await (await fetch(`${b}/api/commits?base=main&head=feature`)).json()
    const last = commits[commits.length - 1].sha
    const { files: cf } = await (await fetch(`${b}/api/diff?base=main&head=feature&commit=${last}&mode=single`)).json()
    assert.ok(cf.length > 0, 'single-commit view lists files')
    const rename = cf.find(f => f.path === 'src/farewell.js')
    assert.ok(rename, 'rename keyed by new path')
    assert.equal(rename.type, 'rename')
  } finally {
    srv.close()
  }
})

test('GET /api/diff with an unknown branch returns a 500 with an error message', async () => {
  const res = await fetch(`${base}/api/diff?base=nope&head=feature`)
  assert.equal(res.status, 500)
  const { error } = await res.json()
  assert.ok(error)
})

test('ws=1 hides a whitespace-only change from both the patch and the file list', async () => {
  const fx = makeFixtureRepo()
  // A commit that only re-indents: the kind of change that makes a branch
  // unreadable without -w.
  writeFileSync(path.join(fx.dir, 'hello.js'), '    export const greet = (name) => `hello ${name}`;\n')
  fx.git('add', '-A')
  fx.git('commit', '-m', 'reindent')

  const srv = createApp(fx.dir).listen(0)
  const b = `http://localhost:${srv.address().port}`
  try {
    const sha = (await (await fetch(`${b}/api/commits?base=main&head=feature`)).json()).at(-1).sha
    const q = `base=main&head=feature&commit=${sha}&mode=single`

    const plain = await (await fetch(`${b}/api/diff?${q}`)).json()
    assert.deepEqual(
      plain.files.map(f => f.path),
      ['hello.js']
    )

    // The file leaves the list entirely, so counts and hunks still agree.
    const ignored = await (await fetch(`${b}/api/diff?${q}&ws=1`)).json()
    assert.deepEqual(ignored.files, [])
    assert.equal(ignored.diff.trim(), '')
  } finally {
    srv.close()
  }
})

test('a base from --base overrides the detected default and joins the branch list', async () => {
  // Its own server: this app is configured differently from the shared one.
  const srv = createApp(fixture.dir, { defaultBase: 'feature' }).listen(0)
  try {
    const repo = await (await fetch(`http://localhost:${srv.address().port}/api/repo`)).json()
    assert.equal(repo.defaultBase, 'feature')
    assert.deepEqual(repo.branches.sort(), ['feature', 'main'])
  } finally {
    srv.close()
  }
})

test('a base from --base that is not a branch is still offered to the picker', async () => {
  const srv = createApp(fixture.dir, { defaultBase: 'v1.0.0' }).listen(0)
  try {
    const repo = await (await fetch(`http://localhost:${srv.address().port}/api/repo`)).json()
    assert.equal(repo.defaultBase, 'v1.0.0')
    assert.ok(repo.branches.includes('v1.0.0'))
  } finally {
    srv.close()
  }
})
