import type { CSSProperties } from 'react';

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-env" aria-hidden="true" />
      <div className="hero-inner">
        <p className="eyebrow hero-eyebrow rise" style={{ '--rd': '0.05s' } as CSSProperties}>Tekken 8 · Personal Roster</p>
        <h1 id="hero-title" className="wordmark-xl rise" style={{ '--rd': '0.14s' } as CSSProperties}>SLEDGE</h1>
        <p className="hero-impression rise" style={{ '--rd': '0.3s' } as CSSProperties}>
          A Tekken 8 devotee whose five-character roster spans the whole game — the disciplined
          all-rounder (Jin), the radiant aggressor (Claudio), the relentless commando (Dragunov),
          the cerebral tactician (Victor), and the electrifying rebel (Lars).
        </p>
        <div className="hero-cta rise" style={{ '--rd': '0.44s' } as CSSProperties}>
          <a className="btn btn-primary" href="#roster">View the roster <span className="arr" aria-hidden="true">→</span></a>
          <a className="btn btn-ghost" href="#jin">Meet my main <span className="arr" aria-hidden="true">→</span></a>
        </div>
      </div>
      <a className="scroll-cue rise" style={{ '--rd': '0.8s' } as CSSProperties} href="#roster" aria-label="Scroll to the roster">
        <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
          <path d="M7 1v13M2.5 10L7 14.5 11.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Scroll
      </a>
    </section>
  );
}
