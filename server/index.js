import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { movies } from '../src/data/movies.js';
import { seedReviews } from './seedReviews.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.FRAMELOG_DB_PATH || join(dataDir, 'framelog.sqlite'));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    genre TEXT NOT NULL,
    director TEXT NOT NULL,
    description TEXT NOT NULL,
    color_start TEXT NOT NULL,
    color_end TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertMovie = db.prepare(`
  INSERT OR IGNORE INTO movies (id, title, year, genre, director, description, color_start, color_end)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const movie of movies) {
  insertMovie.run(movie.id, movie.title, movie.year, movie.genre, movie.director,
    movie.description, movie.colors[0], movie.colors[1]);
}

// --- Feature: "My Reviews" ownership + seeded reviews -----------------------------------
// owner_id is a random token the browser generates and keeps in localStorage. Only the
// browser holding that token can edit or delete a review. Older rows and seeded rows
// have no owner, so nobody can edit them.
if (!db.prepare('PRAGMA table_info(reviews)').all().some((column) => column.name === 'owner_id')) {
  db.exec('ALTER TABLE reviews ADD COLUMN owner_id TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_owner ON reviews(owner_id)');

if (db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE owner_id = 'seed'").get().n === 0) {
  const idByTitle = new Map(db.prepare('SELECT id, title FROM movies').all().map((row) => [row.title, row.id]));
  const insertSeed = db.prepare(`
    INSERT INTO reviews (movie_id, name, rating, body, created_at, owner_id)
    VALUES (?, ?, ?, ?, ?, 'seed')
  `);
  for (const [title, name, rating, body, createdAt] of seedReviews) {
    const movieId = idByTitle.get(title);
    if (movieId) insertSeed.run(movieId, name, rating, body, createdAt);
  }
}

const ownerPattern = /^[A-Za-z0-9-]{8,64}$/;
function readOwner(value) {
  return typeof value === 'string' && ownerPattern.test(value) && value !== 'seed' ? value : '';
}
function validateReviewFields(rating, body) {
  const cleanBody = typeof body === 'string' ? body.trim() : '';
  const ok = Number.isInteger(rating) && rating >= 1 && rating <= 5 &&
    cleanBody.length >= 10 && cleanBody.length <= 1000;
  return { ok, cleanBody };
}

const movieColumns = `id, title, year, genre, director, description,
  json_array(color_start, color_end) AS colors`;
function parseMovie(row) {
  return row ? { ...row, colors: JSON.parse(row.colors) } : null;
}
const getMovie = db.prepare(`SELECT ${movieColumns} FROM movies WHERE id = ?`);
function findMovie(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? getMovie.get(id) : null;
}
// Catalogue with each movie's average rating and review count (used by the rating filters).
const listMovies = db.prepare(`
  SELECT m.id, m.title, m.year, m.genre, m.director, m.description,
    json_array(m.color_start, m.color_end) AS colors,
    ROUND(AVG(r.rating), 1) AS avgRating,
    COUNT(r.id) AS reviewCount
  FROM movies m LEFT JOIN reviews r ON r.movie_id = m.id
  GROUP BY m.id
  ORDER BY m.title COLLATE NOCASE
`);
const listReviews = db.prepare(`
  SELECT id, movie_id AS movieId, name, rating, body, created_at AS createdAt,
    (owner_id IS NOT NULL AND owner_id = ?) AS mine
  FROM reviews WHERE movie_id = ? ORDER BY id DESC
`);
const listMyReviews = db.prepare(`
  SELECT r.id, r.movie_id AS movieId, r.name, r.rating, r.body, r.created_at AS createdAt,
    m.title AS movieTitle, m.year AS movieYear,
    json_array(m.color_start, m.color_end) AS colors
  FROM reviews r JOIN movies m ON m.id = r.movie_id
  WHERE r.owner_id = ? ORDER BY r.id DESC
`);
const insertReview = db.prepare('INSERT INTO reviews (movie_id, name, rating, body, owner_id) VALUES (?, ?, ?, ?, ?)');
const getReviewOwner = db.prepare('SELECT owner_id AS ownerId FROM reviews WHERE id = ?');
const updateReview = db.prepare('UPDATE reviews SET rating = ?, body = ? WHERE id = ?');
const deleteReview = db.prepare('DELETE FROM reviews WHERE id = ?');
const getReview = db.prepare(`
  SELECT id, movie_id AS movieId, name, rating, body, created_at AS createdAt, 1 AS mine
  FROM reviews WHERE id = ?
`);
const asReview = (row) => ({ ...row, mine: Boolean(row.mine) });

const app = express();
app.use(express.json({ limit: '16kb' }));

app.get('/api/movies', (_request, response) => {
  response.json(listMovies.all().map(parseMovie));
});

app.get('/api/movies/:id', (request, response) => {
  const movie = findMovie(request.params.id);
  if (!movie) return response.status(404).json({ error: 'Movie not found.' });
  response.json(parseMovie(movie));
});

app.get('/api/movies/:id/reviews', (request, response) => {
  if (!findMovie(request.params.id)) {
    return response.status(404).json({ error: 'Movie not found.' });
  }
  const owner = readOwner(request.query.owner);
  response.json(listReviews.all(owner, Number(request.params.id)).map(asReview));
});

app.post('/api/movies/:id/reviews', (request, response) => {
  const movieId = Number(request.params.id);
  if (!findMovie(request.params.id)) {
    return response.status(404).json({ error: 'Movie not found.' });
  }
  const { name, rating, body, ownerId } = request.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const fields = validateReviewFields(rating, body);
  if (cleanName.length < 2 || cleanName.length > 60 || !fields.ok) {
    return response.status(400).json({ error: 'Enter a name (2–60 characters), a rating (1–5), and a review (10–1000 characters).' });
  }
  const owner = readOwner(ownerId) || null;
  const result = insertReview.run(movieId, cleanName, rating, fields.cleanBody, owner);
  const review = getReview.get(result.lastInsertRowid);
  response.status(201).json({ ...asReview(review), mine: Boolean(owner) });
});

// All reviews written from this browser (identified by its owner token).
app.get('/api/my-reviews', (request, response) => {
  const owner = readOwner(request.query.owner);
  if (!owner) return response.json([]);
  response.json(listMyReviews.all(owner).map((row) => ({ ...row, colors: JSON.parse(row.colors) })));
});

function authorizeReview(request, response) {
  const id = Number(request.params.id);
  const owner = readOwner(request.query.owner ?? request.body?.ownerId);
  const row = Number.isSafeInteger(id) && id > 0 ? getReviewOwner.get(id) : null;
  if (!row) { response.status(404).json({ error: 'Review not found.' }); return null; }
  if (!owner || row.ownerId !== owner) {
    response.status(403).json({ error: 'You can only change reviews you posted from this browser.' });
    return null;
  }
  return id;
}

app.put('/api/reviews/:id', (request, response) => {
  const id = authorizeReview(request, response);
  if (id === null) return;
  const { rating, body } = request.body ?? {};
  const fields = validateReviewFields(rating, body);
  if (!fields.ok) {
    return response.status(400).json({ error: 'Enter a rating (1–5) and a review (10–1000 characters).' });
  }
  updateReview.run(rating, fields.cleanBody, id);
  response.json(asReview(getReview.get(id)));
});

app.delete('/api/reviews/:id', (request, response) => {
  const id = authorizeReview(request, response);
  if (id === null) return;
  deleteReview.run(id);
  response.status(204).end();
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Invalid JSON request.' });
  }
  console.error(error);
  response.status(500).json({ error: 'Something went wrong on the server.' });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, (error) => {
  if (error) {
    console.error('Could not start FrameLog API:', error);
    process.exitCode = 1;
    return;
  }
  console.log(`FrameLog API: http://localhost:${port}`);
});
