import { useEffect, useState } from 'react';

export default function MovieDetailPage({ movie, saved, watched, onToggleWatchlist, onSetWatched }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [rating, setRating] = useState('');
  const [body, setBody] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/movies/${movie.id}/reviews`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load reviews.');
        return response.json();
      })
      .then(setReviews)
      .catch((error) => { if (error.name !== 'AbortError') setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [movie.id]);

  async function submitReview(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanBody = body.trim();
    if (cleanName.length < 2 || cleanName.length > 60 || !rating || cleanBody.length < 10 || cleanBody.length > 1000) {
      setSubmitError('Enter a name (2–60 characters), a rating, and a review (10–1000 characters).');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch(`/api/movies/${movie.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, rating: Number(rating), body: cleanBody }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your review.');
      setReviews((current) => [data, ...current]);
      setBody('');
      setRating('');
      setLoadError('');
    } catch (error) {
      setSubmitError(error.message || 'Could not save your review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container inner-page">
      <a className="back-link" href="/">← Back to discover</a>
      <div className="detail-layout">
        <div className="detail-art" style={{ background: `linear-gradient(145deg, ${movie.colors[0]}, ${movie.colors[1]})` }} aria-hidden="true"><span>{movie.title}</span></div>
        <div className="detail-copy">
          <p className="eyebrow">MOVIE DETAILS</p>
          <h1>{movie.title}</h1>
          <div className="detail-meta"><span>{movie.year}</span><span>{movie.genre}</span><span>Directed by {movie.director}</span></div>
          <p className="detail-description">{movie.description}</p>
          <div className="detail-actions">
            <button className="hero-link button-link" type="button" onClick={() => onToggleWatchlist(movie.id)}>{saved ? '✓ Remove from watchlist' : '+ Add to watchlist'}</button>
            {saved && <label className="watched-control"><input type="checkbox" checked={watched} onChange={(event) => onSetWatched(movie.id, event.target.checked)} /> Mark as watched</label>}
          </div>
        </div>
      </div>

      <section className="reviews-section" aria-labelledby="reviews-title">
        <div className="section-heading"><div><p className="eyebrow">COMMUNITY NOTES</p><h2 id="reviews-title">Reviews</h2></div><span className="result-count">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span></div>
        <div className="reviews-layout">
          <div className="review-list" aria-live="polite">
            {loading ? <p className="muted">Loading reviews…</p> : loadError ? <p className="form-error" role="alert">{loadError}</p> : reviews.length ? reviews.map((review) => <article className="review" key={review.id}>
              <div className="review-header"><strong>{review.name}</strong><span className="stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
              <p>{review.body}</p><time dateTime={`${review.createdAt.replace(' ', 'T')}Z`}>{new Date(`${review.createdAt.replace(' ', 'T')}Z`).toLocaleDateString()}</time>
            </article>) : <div className="empty-state compact"><p>No reviews yet. Be the first to share your thoughts.</p></div>}
          </div>
          <form className="review-form" onSubmit={submitReview}>
            <h3>Write a review</h3>
            <p className="muted">Share a short, respectful note about this film.</p>
            <div className="field"><label htmlFor="review-name">Your name</label><input id="review-name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="60" required /></div>
            <div className="field"><label htmlFor="review-rating">Rating</label><select id="review-rating" value={rating} onChange={(event) => setRating(event.target.value)} required><option value="">Choose a rating</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}</select></div>
            <div className="field"><label htmlFor="review-body">Your review</label><textarea id="review-body" value={body} onChange={(event) => setBody(event.target.value)} minLength="10" maxLength="1000" rows="5" required /></div>
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
            <button className="hero-link button-link" type="submit" disabled={submitting}>{submitting ? 'Posting…' : 'Post review'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
