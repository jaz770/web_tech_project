# FrameLog

A movie discovery and personal watchlist project. Browse 36 curated films, search by title or director, filter by genre, sort by year or title, open a movie detail page, and post reviews. The personal watchlist supports add, remove, and mark as watched.

## Requirements and setup

- Node.js 24 or newer and npm. The API uses Node's built-in SQLite module.
- From this project directory, run `npm install` once.
- Run `npm run dev`, then open the **Local** URL printed by Vite (usually `http://localhost:5173/`). This one command starts the Vite frontend and the Express API.

Do not use VS Code Live Server for the React app. If port 5173 is in use, Vite may choose another port; use the URL it prints. If port 3001 is in use, stop the other process before starting FrameLog.

## Project files

| Path | Purpose |
| --- | --- |
| `src/data/movies.js` | Starter catalogue, seeded into SQLite at API startup |
| `src/pages/DiscoverPage.jsx` | Browse, search, filter, and sort |
| `src/pages/MovieDetailPage.jsx` | Movie details, review list, and review form |
| `src/pages/WatchlistPage.jsx` | Saved movies and watched status |
| `src/components/` | Shared header and movie card |
| `src/App.jsx` | Page selection, catalogue request, and watchlist state |
| `src/pages/MyReviewsPage.jsx` | My Reviews: list, edit, and delete your own reviews |
| `src/lib/owner.js` | Per-browser owner token and saved reviewer name |
| `server/index.js` | Express API and SQLite setup |
| `server/seedReviews.js` | Hardcoded starter reviews (inserted once) |
| `server/data/framelog.sqlite` | Generated SQLite database; ignored by Git |

The watchlist is saved in this browser's `localStorage`. It does not sync between browsers or devices. Reviews and the catalogue are stored in SQLite. Existing catalogue rows are preserved when the API restarts; new starter entries are added on startup.

## API and checks

- `GET /api/movies` returns the catalogue with `avgRating` and `reviewCount` for each movie.
- `GET /api/movies/:id` returns one movie.
- `GET /api/movies/:id/reviews?owner=TOKEN` returns reviews, newest first. `mine` is true for reviews posted with that token.
- `GET /api/my-reviews?owner=TOKEN` returns every review posted from this browser.
- `PUT /api/reviews/:id?owner=TOKEN` edits `rating` and `body`; `DELETE /api/reviews/:id?owner=TOKEN` removes the review. Only the matching owner token is allowed (403 otherwise).
- `POST /api/movies/:id/reviews` accepts JSON with `name`, `rating`, `body`, and an optional `ownerId`. The server validates all three fields.

Run `npm run build` to check the frontend, `npm run lint` for code checks, and `npm test` for the API smoke test. The smoke test uses a temporary database and checks review persistence after a restart.

## Added features

1. **Rating filters and sorting** (Discover page): minimum-rating filter, "Only movies with reviews" toggle, and "Highest rated" / "Most reviewed" sorts. Averages come from a SQL `LEFT JOIN ... GROUP BY` in `/api/movies`, and cards show the average and review count.
2. **My Reviews**: the browser keeps a random owner token in `localStorage` (no login). The My Reviews page lists reviews posted from that browser and lets you edit or delete them; other people's and seeded reviews are read-only.

About 26 hardcoded reviews across 20 movies are inserted once on first start so the filters have data.
