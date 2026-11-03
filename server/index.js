import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { movies } from '../src/data/movies.js';

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
const listMovies = db.prepare(`SELECT ${movieColumns} FROM movies ORDER BY title COLLATE NOCASE`);
const listReviews = db.prepare(`
  SELECT id, movie_id AS movieId, name, rating, body, created_at AS createdAt
  FROM reviews WHERE movie_id = ? ORDER BY id DESC
`);
const insertReview = db.prepare('INSERT INTO reviews (movie_id, name, rating, body) VALUES (?, ?, ?, ?)');

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
  response.json(listReviews.all(Number(request.params.id)));
});

app.post('/api/movies/:id/reviews', (request, response) => {
  const movieId = Number(request.params.id);
  if (!findMovie(request.params.id)) {
    return response.status(404).json({ error: 'Movie not found.' });
  }
  const { name, rating, body } = request.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanBody = typeof body === 'string' ? body.trim() : '';
  if (cleanName.length < 2 || cleanName.length > 60 ||
      !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      cleanBody.length < 10 || cleanBody.length > 1000) {
    return response.status(400).json({ error: 'Enter a name (2–60 characters), a rating (1–5), and a review (10–1000 characters).' });
  }
  const result = insertReview.run(movieId, cleanName, rating, cleanBody);
  const review = db.prepare(`
    SELECT id, movie_id AS movieId, name, rating, body, created_at AS createdAt
    FROM reviews WHERE id = ?
  `).get(result.lastInsertRowid);
  response.status(201).json(review);
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
