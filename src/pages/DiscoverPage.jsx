import { useMemo, useState } from 'react';
import MovieCard from '../components/MovieCard.jsx';

export default function DiscoverPage({ movies, watchlist, onToggleWatchlist }) {
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('All genres');
  const [sort, setSort] = useState('title');
  const genres = useMemo(() => ['All genres', ...new Set(movies.map((movie) => movie.genre))].sort((a, b) => a === 'All genres' ? -1 : b === 'All genres' ? 1 : a.localeCompare(b)), [movies]);

  const visibleMovies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return movies.filter((movie) =>
      (movie.title.toLowerCase().includes(query) || movie.director.toLowerCase().includes(query)) &&
      (genre === 'All genres' || movie.genre === genre)
    ).sort((a, b) => {
      if (sort === 'newest') return b.year - a.year || a.title.localeCompare(b.title);
      if (sort === 'oldest') return a.year - b.year || a.title.localeCompare(b.title);
      return a.title.localeCompare(b.title);
    });
  }, [movies, search, genre, sort]);

  return (
    <main>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">YOUR NEXT FILM STARTS HERE</p>
          <h1>Discover something worth watching.</h1>
          <p className="hero-copy">Explore films across genres. Find an old favorite or something completely new to you.</p>
          <a className="hero-link" href="#catalog">Explore the catalogue <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className="container catalog-section" id="catalog" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div><p className="eyebrow">THE COLLECTION</p><h2 id="catalog-title">Browse movies</h2></div>
          <p className="result-count" role="status">{visibleMovies.length} {visibleMovies.length === 1 ? 'movie' : 'movies'}</p>
        </div>
        <div className="filters" role="group" aria-label="Catalogue filters">
          <div className="field search-field">
            <label htmlFor="movie-search">Search by title or director</label>
            <input id="movie-search" type="search" placeholder="Search movies..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="genre-filter">Genre</label>
            <select id="genre-filter" value={genre} onChange={(event) => setGenre(event.target.value)}>
              {genres.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort-order">Sort by</label>
            <select id="sort-order" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="title">Title A–Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        {visibleMovies.length ? (
          <div className="movie-grid">
            {visibleMovies.map((movie) => {
              const entry = watchlist.find((item) => item.id === movie.id);
              return <MovieCard key={movie.id} movie={movie} saved={Boolean(entry)} watched={entry?.watched} onToggleWatchlist={onToggleWatchlist} />;
            })}
          </div>
        ) : <div className="empty-state"><h3>No movies found</h3><p>Try another title, director, or genre.</p></div>}
      </section>
    </main>
  );
}
