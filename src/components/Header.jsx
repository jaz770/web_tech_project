export default function Header({ currentPage, watchlistCount }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="/" aria-label="FrameLog home">
          <span className="brand-mark" aria-hidden="true">▶</span>
          FrameLog
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className={`nav-link${currentPage === 'discover' ? ' active' : ''}`} href="/" aria-current={currentPage === 'discover' ? 'page' : undefined}>Discover</a>
          <a className={`nav-link${currentPage === 'watchlist' ? ' active' : ''}`} href="/watchlist" aria-current={currentPage === 'watchlist' ? 'page' : undefined}>
            Watchlist <span className="nav-count">{watchlistCount}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
