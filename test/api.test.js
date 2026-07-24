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

test('GET /api/diff with an unknown branch returns a 500 with an error message', async () => {
  const res = await fetch(`${base}/api/diff?base=nope&head=feature`);
  assert.equal(res.status, 500);
  const { error } = await res.json();
  assert.ok(error);
});
