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

  // Seeded reviews feed the rating aggregates used by the filters.
  const seeded = movies.filter((movie) => movie.reviewCount > 0);
  assert.ok(seeded.length >= 10, 'expected seeded reviews on at least 10 movies');
  assert.ok(seeded.every((movie) => movie.avgRating >= 1 && movie.avgRating <= 5));
  const target = movies.find((movie) => movie.reviewCount === 0);
  assert.ok(target, 'expected at least one movie without reviews');
  const reviewsUrl = `${base}/api/movies/${target.id}/reviews`;
  assert.equal((await fetch(reviewsUrl)).status, 200);

  const post = (payload) => fetch(reviewsUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal((await post({ name: 'A', rating: 6, body: 'Too short' })).status, 400);

  const owner = 'owner-token-12345';
  const valid = await post({ name: 'Test viewer', rating: 5, body: 'An absorbing film with memorable imagery.', ownerId: owner });
  assert.equal(valid.status, 201);
  const created = await valid.json();
  assert.equal(created.movieId, target.id);
  assert.equal(created.mine, true);
  assert.equal('ownerId' in created || 'owner_id' in created, false, 'owner token must not leak');

  // My Reviews: only the owner sees, edits, or deletes their review.
  const mine = await (await fetch(`${base}/api/my-reviews?owner=${owner}`)).json();
  assert.equal(mine.length, 1);
  assert.equal(mine[0].movieTitle, target.title);
  assert.deepEqual(await (await fetch(`${base}/api/my-reviews?owner=someone-else-999`)).json(), []);
  const listed = await (await fetch(`${reviewsUrl}?owner=${owner}`)).json();
  assert.equal(listed[0].mine, true);
  assert.equal((await (await fetch(reviewsUrl)).json())[0].mine, false);

  const edit = (who, payload) => fetch(`${base}/api/reviews/${created.id}?owner=${who}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal((await edit('someone-else-999', { rating: 1, body: 'Trying to edit this review.' })).status, 403);
  assert.equal((await edit(owner, { rating: 9, body: 'x' })).status, 400);
  const edited = await edit(owner, { rating: 3, body: 'Changed my mind after a second watch.' });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).rating, 3);

  const withReview = (await (await fetch(`${base}/api/movies`)).json()).find((movie) => movie.id === target.id);
  assert.equal(withReview.reviewCount, 1);
  assert.equal(withReview.avgRating, 3);

  // Seeded reviews have no owner and cannot be changed.
  const seededReviews = await (await fetch(`${base}/api/movies/${seeded[0].id}/reviews`)).json();
  assert.equal((await fetch(`${base}/api/reviews/${seededReviews[0].id}?owner=${owner}`, { method: 'DELETE' })).status, 403);

  await stop();
  await start();
  const saved = await (await fetch(reviewsUrl)).json();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].rating, 3);
  const afterRestart = await (await fetch(`${base}/api/movies`)).json();
  assert.equal(afterRestart.reduce((sum, movie) => sum + movie.reviewCount, 0), seeded.reduce((sum, movie) => sum + movie.reviewCount, 0) + 1, 'seed must not duplicate on restart');

  assert.equal((await fetch(`${base}/api/reviews/${created.id}?owner=${owner}`, { method: 'DELETE' })).status, 204);
  assert.deepEqual(await (await fetch(`${base}/api/my-reviews?owner=${owner}`)).json(), []);
  console.log('API smoke test passed: catalogue, rating aggregates, seeded reviews, My Reviews (create/edit/delete/ownership), and SQLite persistence.');
} finally {
  await stop();
  rmSync(tempDir, { recursive: true, force: true });
}
