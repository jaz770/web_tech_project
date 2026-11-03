import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import MovieDetailPage from './pages/MovieDetailPage.jsx';
import WatchlistPage from './pages/WatchlistPage.jsx';
import MyReviewsPage from './pages/MyReviewsPage.jsx';

const storageKey = 'framelog-watchlist-v1';
function readWatchlist() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(data) ? data.filter((entry) => Number.isSafeInteger(entry?.id) && typeof entry?.watched === 'boolean') : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState(readWatchlist);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/movies', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the movie catalogue.');
        return response.json();
      })
      .then(setMovies)
      .catch((fetchError) => { if (fetchError.name !== 'AbortError') setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(watchlist)); } catch { /* Browser storage can be unavailable. */ }
  }, [watchlist]);

  function toggleWatchlist(id) {
    setWatchlist((current) => current.some((entry) => entry.id === id)
      ? current.filter((entry) => entry.id !== id)
      : [...current, { id, watched: false }]);
  }
  function setWatched(id, watched) {
    setWatchlist((current) => current.map((entry) => entry.id === id ? { ...entry, watched } : entry));
  }

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const detailMatch = /^\/movies\/(\d+)$/.exec(path);
  const currentPage = path === '/' ? 'discover' : path === '/watchlist' ? 'watchlist' : path === '/my-reviews' ? 'myreviews' : detailMatch ? 'detail' : 'unknown';
  const movie = detailMatch ? movies.find((item) => item.id === Number(detailMatch[1])) : null;
  const entry = movie ? watchlist.find((item) => item.id === movie.id) : null;

  return <>
    <Header currentPage={currentPage} watchlistCount={watchlist.length} />
    {loading ? <main className="container inner-page"><p role="status">Loading movies…</p></main>
      : error ? <main className="container inner-page error-page"><h1>Could not load movies</h1><p>{error}</p><p>Make sure the API is running with <code>npm run dev</code>, then refresh this page.</p></main>
      : currentPage === 'discover' ? <DiscoverPage movies={movies} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} />
      : currentPage === 'watchlist' ? <WatchlistPage movies={movies} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} onSetWatched={setWatched} />
      : currentPage === 'myreviews' ? <MyReviewsPage />
      : movie ? <MovieDetailPage movie={movie} saved={Boolean(entry)} watched={entry?.watched || false} onToggleWatchlist={toggleWatchlist} onSetWatched={setWatched} />
      : <main className="container inner-page error-page"><h1>Page not found</h1><p>There is no movie or page at this address.</p><a className="hero-link" href="/">Back to discover</a></main>}
    <footer className="site-footer"><div className="container"><span>FrameLog</span><span>A movie discovery project · Your watchlist is saved in this browser</span></div></footer>
  </>;
}
