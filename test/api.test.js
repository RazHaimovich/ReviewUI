import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { makeFixtureRepo } from './fixture.js';

const fixture = makeFixtureRepo();
const server = createApp(fixture.dir).listen(0);
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

test('GET /api/repo reports branches, current branch and default base', async () => {
  const res = await fetch(`${base}/api/repo`);
  assert.equal(res.status, 200);
  const repo = await res.json();
  assert.deepEqual(repo.branches.sort(), ['feature', 'main']);
  assert.equal(repo.current, 'feature');
  assert.equal(repo.defaultBase, 'main');
  assert.ok(repo.name);
});

test('GET /api/diff returns the three-dot diff between base and head', async () => {
  const res = await fetch(`${base}/api/diff?base=main&head=feature`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(body, fixture.git('diff', 'main...feature'));
  assert.match(body, /hello \$\{name\}/);
  assert.match(body, /src\/bye\.js/);
});

test('GET /api/commits lists branch commits oldest-first', async () => {
  const res = await fetch(`${base}/api/commits?base=main&head=feature`);
  assert.equal(res.status, 200);
  const commits = await res.json();
  assert.deepEqual(
    commits.map((c) => c.subject),
    ['greet takes a name', 'add bye']
  );
  for (const c of commits) {
    assert.match(c.sha, /^[0-9a-f]{40}$/);
    assert.ok(c.shortSha && c.author && c.date);
  }
});

test('single-commit diff matches git show', async () => {
  const commits = await (await fetch(`${base}/api/commits?base=main&head=feature`)).json();
  const first = commits[0].sha;
  const res = await fetch(`${base}/api/diff?base=main&head=feature&commit=${first}&mode=single`);
  const body = await res.text();
  assert.equal(body, fixture.git('show', '--format=', '--patch', first));
  assert.match(body, /hello \$\{name\}/);
  assert.doesNotMatch(body, /bye\.js/);
});

test('cumulative diff matches git diff from merge-base', async () => {
  const commits = await (await fetch(`${base}/api/commits?base=main&head=feature`)).json();
  const second = commits[1].sha;
  const res = await fetch(`${base}/api/diff?base=main&head=feature&commit=${second}&mode=cumulative`);
  const body = await res.text();
  const mergeBase = fixture.git('merge-base', 'main', 'feature').trim();
  assert.equal(body, fixture.git('diff', `${mergeBase}..${second}`));
  assert.match(body, /hello \$\{name\}/);
  assert.match(body, /bye\.js/);
});

test('refs that look like git flags are rejected with 400', async () => {
  const res = await fetch(`${base}/api/diff?base=--output=/tmp/pwned&head=feature`);
  assert.equal(res.status, 400);
});

test('non-local Host headers are rejected (DNS rebinding)', async () => {
  // fetch() refuses to override Host, so use the raw http client.
  const status = await new Promise((resolve, reject) => {
    http
      .get(`${base}/api/repo`, { headers: { Host: 'evil.example.com' } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on('error', reject);
  });
  assert.equal(status, 403);
});

test('comments round-trip into the generated prompt', async () => {
  const post = (payload) =>
    fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

  const created = await post({
    filePath: 'hello.js',
    side: 'new',
    startLine: 1,
    endLine: 1,
    snippet: '+export const greet = (name) => `hello ${name}`;',
    body: 'Use a default value for name',
    commitSha: null,
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();

  await post({
    filePath: 'src/bye.js',
    side: 'new',
    startLine: 1,
    endLine: 1,
    snippet: '+export const bye = () => "bye";',
    body: 'Add a test for bye',
    commitSha: 'abcdef1234567890',
  });

  const listed = await (await fetch(`${base}/api/comments`)).json();
  assert.equal(listed.length, 2);

  const promptRes = await fetch(`${base}/api/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base: 'main', head: 'feature' }),
  });
  assert.equal(promptRes.status, 200);
  const prompt = await promptRes.text();
  assert.match(prompt, /## 1\. hello\.js:1/);
  assert.match(prompt, /Use a default value for name/);
  assert.match(prompt, /hello \$\{name\}/);
  assert.match(prompt, /## 2\. src\/bye\.js:1 \(commented on commit abcdef1\)/);
  assert.match(prompt, /locate the referenced snippet/);

  // delete removes from store and from the next prompt
  assert.equal((await fetch(`${base}/api/comments/${id}`, { method: 'DELETE' })).status, 200);
  const after = await (await fetch(`${base}/api/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base: 'main', head: 'feature' }),
  })).text();
  assert.doesNotMatch(after, /hello\.js:1/);
  assert.match(after, /## 1\. src\/bye\.js:1/);

  // invalid comment payloads are rejected
  assert.equal((await post({ body: 'no file' })).status, 400);
});

test('GET /api/diff with an unknown branch returns a 500 with an error message', async () => {
  const res = await fetch(`${base}/api/diff?base=nope&head=feature`);
  assert.equal(res.status, 500);
  const { error } = await res.json();
  assert.ok(error);
});
