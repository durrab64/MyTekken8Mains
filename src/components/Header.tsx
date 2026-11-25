export default function Header() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="wordmark" href="#top">SLEDGE</a>
        <nav className="nav-links" aria-label="Primary">
          <a href="#roster">Roster</a>
          <a href="#about">About</a>
        </nav>
      </div>
    </header>
  );
}
