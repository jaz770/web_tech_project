import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'framelog-test-'));
const port = 39000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), FRAMELOG_DB_PATH: join(tempDir, 'test.sqlite') };
let server;

async function start() {
  server = spawn(process.execPath, ['server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stderr.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`API exited early: ${output}`);
    try {
      const response = await fetch(`${base}/api/movies`);
      if (response.ok) return;
    } catch { /* Wait for server startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not start: ${output}`);
}

async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM');
  await exited;
}

try {
  await start();
  const movies = await (await fetch(`${base}/api/movies`)).json();
  assert.equal(movies.length, 36);
  assert.equal(movies[0].colors.length, 2);
  assert.equal((await fetch(`${base}/api/movies/unknown`)).status, 404);
  assert.equal((await fetch(`${base}/api/movies/1/reviews`)).status, 200);

  const invalid = await fetch(`${base}/api/movies/1/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', rating: 6, body: 'Too short' }),
  });
  assert.equal(invalid.status, 400);

  const valid = await fetch(`${base}/api/movies/1/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test viewer', rating: 5, body: 'An absorbing film with memorable imagery.' }),
  });
  assert.equal(valid.status, 201);
  const created = await valid.json();
  assert.equal(created.movieId, 1);

  await stop();
  await start();
  const saved = await (await fetch(`${base}/api/movies/1/reviews`)).json();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].body, created.body);
  console.log('API smoke test passed: catalogue, validation, reviews, and SQLite persistence.');
} finally {
  await stop();
  rmSync(tempDir, { recursive: true, force: true });
}
