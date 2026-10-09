import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';
import { fileURLToPath } from 'node:url';

test('serve the lab, reject invalid controls, and keep private files private', async t => {
  const server = spawn(process.execPath, ['server.mjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, PORT: '0', NT_PORT: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { server.kill('SIGTERM'); if (server.exitCode === null) await once(server, 'exit'); });
  let output = '';
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Server startup timeout: ' + output)), 5000);
    server.on('error', reject);
    server.stdout.on('data', chunk => { output += chunk; const match = output.match(/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); } });
    server.stderr.on('data', chunk => { output += chunk; });
  });
  const base = `http://localhost:${port}`;
  for (const path of ['/', '/learn.html', '/src/learning.js', '/learning.css', '/docs/learning-lab.md', '/api/health']) {
    assert.equal((await fetch(base + path)).status, 200, path);
  }
  for (const path of ['/.git/config', '/package-lock.json', '/wpilib-robot/build.gradle', '/lib/nt4-bridge.mjs']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base + '/%xx')).status, 400);
  assert.equal((await fetch(base + '/api/lab/status', { headers: { origin: 'http://unrelated.example' } })).status, 403);
  // fetch may replace Host, so use an HTTP request to exercise this boundary directly.
  const foreignHostStatus = await new Promise((resolve, reject) => {
    get(base + '/api/lab/status', { headers: { host: 'unrelated.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(base + '/api/lab/controls', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(base + '/api/lab/controls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
  assert.equal((await fetch(base + '/api/lab/controls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ huge: 'a'.repeat(3000) }) })).status, 413);
  assert.equal((await (await fetch(base + '/api/lab/status')).json()).connected, false);
});
