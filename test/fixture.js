import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function run(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

// A repo with main + a feature branch carrying two commits.
export function makeFixtureRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'reviewui-fixture-'));
  run(dir, 'init', '-b', 'main');
  run(dir, 'config', 'user.email', 'test@reviewui.local');
  run(dir, 'config', 'user.name', 'ReviewUI Test');

  writeFileSync(path.join(dir, 'hello.js'), 'export const greet = () => "hello";\n');
  run(dir, 'add', '-A');
  run(dir, 'commit', '-m', 'initial');

  run(dir, 'checkout', '-b', 'feature');
  writeFileSync(path.join(dir, 'hello.js'), 'export const greet = (name) => `hello ${name}`;\n');
  run(dir, 'add', '-A');
  run(dir, 'commit', '-m', 'greet takes a name');

  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src', 'bye.js'), 'export const bye = () => "bye";\n');
  run(dir, 'add', '-A');
  run(dir, 'commit', '-m', 'add bye');

  return { dir, git: (...args) => run(dir, ...args) };
}
