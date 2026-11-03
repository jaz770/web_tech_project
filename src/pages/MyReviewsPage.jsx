import { useEffect, useState } from 'react';
import { formatDate, getOwnerId } from '../lib/owner.js';

function ReviewItem({ review, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(String(review.rating));
  const [body, setBody] = useState(review.body);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = encodeURIComponent(getOwnerId());

  async function save(event) {
    event.preventDefault();
    const cleanBody = body.trim();
    if (cleanBody.length < 10 || cleanBody.length > 1000) {
      setError('Your review must be 10–1000 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/reviews/${review.id}?owner=${owner}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: Number(rating), body: cleanBody }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update your review.');
      onChanged({ ...review, rating: data.rating, body: data.body });
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message || 'Could not update your review.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete your review of ${review.movieTitle}?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/reviews/${review.id}?owner=${owner}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete your review.');
      }
      onDeleted(review.id);
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete your review.');
      setBusy(false);
    }
  }

  return (
    <article className="review my-review">
      <div className="review-header">
        <strong><a href={`/movies/${review.movieId}`}>{review.movieTitle}</a> <span className="muted">({review.movieYear})</span></strong>
        <span className="stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
      </div>
      {editing ? (
        <form onSubmit={save}>
          <div className="field"><label htmlFor={`rating-${review.id}`}>Rating</label>
            <select id={`rating-${review.id}`} value={rating} onChange={(event) => setRating(event.target.value)}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor={`body-${review.id}`}>Your review</label>
            <textarea id={`body-${review.id}`} value={body} onChange={(event) => setBody(event.target.value)} minLength="10" maxLength="1000" rows="4" />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="review-actions">
            <button className="small-button saved" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button className="small-button" type="button" disabled={busy} onClick={() => { setEditing(false); setRating(String(review.rating)); setBody(review.body); setError(''); }}>Cancel</button>
          </div>
        </form>
      ) : <>
        <p>{review.body}</p>
        <time dateTime={`${review.createdAt.replace(' ', 'T')}Z`}>Posted {formatDate(review.createdAt)}</time>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="review-actions">
          <button className="small-button" type="button" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
          <button className="small-button danger" type="button" disabled={busy} onClick={remove}>Delete</button>
        </div>
      </>}
    </article>
  );
}

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/my-reviews?owner=${encodeURIComponent(getOwnerId())}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load your reviews.');
        return response.json();
      })
      .then(setReviews)
      .catch((fetchError) => { if (fetchError.name !== 'AbortError') setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <main className="container inner-page" aria-labelledby="my-reviews-title">
      <p className="eyebrow">YOUR VOICE</p>
      <div className="section-heading">
        <div><h1 id="my-reviews-title">My reviews</h1><p className="page-intro">Every review you have posted from this browser. You can edit or delete them here.</p></div>
        <p className="result-count">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}{average ? ` · ${average} ★ average` : ''}</p>
      </div>
      {loading ? <p className="muted" role="status">Loading your reviews…</p>
        : error ? <p className="form-error" role="alert">{error}</p>
        : reviews.length ? <div className="review-list">
          {reviews.map((review) => <ReviewItem key={review.id} review={review}
            onChanged={(updated) => setReviews((current) => current.map((item) => item.id === updated.id ? updated : item))}
            onDeleted={(id) => setReviews((current) => current.filter((item) => item.id !== id))} />)}
        </div>
        : <div className="empty-state"><h2>You have not posted any reviews yet</h2><p>Open a movie and share a short note. It will show up here.</p><a className="hero-link" href="/">Explore movies <span aria-hidden="true">→</span></a></div>}
    </main>
  );
}
