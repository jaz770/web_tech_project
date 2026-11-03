import MovieCard from '../components/MovieCard.jsx';

export default function WatchlistPage({ movies, watchlist, onToggleWatchlist, onSetWatched }) {
  const savedMovies = watchlist.map((entry) => ({ entry, movie: movies.find((movie) => movie.id === entry.id) })).filter(({ movie }) => movie);
  const watchedCount = savedMovies.filter(({ entry }) => entry.watched).length;

  return (
    <main className="container inner-page" aria-labelledby="watchlist-title">
      <p className="eyebrow">YOUR COLLECTION</p>
      <div className="section-heading">
        <div><h1 id="watchlist-title">My watchlist</h1><p className="page-intro">Keep track of what you want to see and what you have watched.</p></div>
        <p className="result-count">{savedMovies.length} saved · {watchedCount} watched</p>
      </div>
      {savedMovies.length ? <div className="watchlist-grid">
        {savedMovies.map(({ entry, movie }) => <div key={movie.id} className="watchlist-item">
          <MovieCard movie={movie} saved watched={entry.watched} onToggleWatchlist={onToggleWatchlist} />
          <label className="watched-control"><input type="checkbox" checked={entry.watched} onChange={(event) => onSetWatched(movie.id, event.target.checked)} /> Mark as watched</label>
        </div>)}
      </div> : <div className="empty-state"><h2>Your watchlist is empty</h2><p>Find a film you want to see and select “+ Watchlist”.</p><a className="hero-link" href="/">Explore movies <span aria-hidden="true">→</span></a></div>}
    </main>
  );
}
