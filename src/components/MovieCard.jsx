export default function MovieCard({ movie, saved, watched, onToggleWatchlist }) {
  return (
    <article className="movie-card">
      <a className="movie-art" href={`/movies/${movie.id}`} style={{ background: `linear-gradient(145deg, ${movie.colors[0]}, ${movie.colors[1]})` }} aria-label={`View details for ${movie.title}`}>
        <span className="movie-art-title">{movie.title}</span>
      </a>
      <div className="movie-card-body">
        <div className="movie-meta"><span>{movie.year}</span><span>{movie.genre}</span></div>
        <h3><a href={`/movies/${movie.id}`}>{movie.title}</a></h3>
        <p className="director">Directed by {movie.director}</p>
        <p className="movie-description">{movie.description}</p>
        <div className="card-actions">
          <button className={`small-button${saved ? ' saved' : ''}`} type="button" onClick={() => onToggleWatchlist(movie.id)} aria-label={`${saved ? 'Remove' : 'Add'} ${movie.title} ${saved ? 'from' : 'to'} watchlist`}>
            {saved ? '✓ In watchlist' : '+ Watchlist'}
          </button>
          {watched && <span className="watched-badge">Watched</span>}
        </div>
      </div>
    </article>
  );
}
