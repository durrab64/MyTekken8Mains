import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import Roster from '../features/roster/Roster';
import About from '../components/About';
import { characters } from '../data/characters';

const DEFAULT_DECK_ORDER = ['dragunov', 'claudio', 'jin', 'lars', 'victor'];

const DECK_NAMES: Record<string, string> = {
  dragunov: 'Dragunov',
  claudio: 'Claudio',
  jin: 'Jin',
  lars: 'Lars',
  victor: 'Victor',
};

export default function Landing() {
  const [deckOpen, setDeckOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deckOrder, setDeckOrder] = useState<string[]>(() => [...DEFAULT_DECK_ORDER]);
  const hoveredRef = useRef<string | null>(null);
  const touchRef = useRef(false);
  const deckRef = useRef<HTMLDivElement>(null);

  const updateHovered = (id: string | null) => {
    hoveredRef.current = id;
    setHoveredId(id);
  };

  const commitHoveredOrder = (id: string | null) => {
    if (!id) return;
    setDeckOrder((current) => (
      current[0] === id ? current : [id, ...current.filter((item) => item !== id)]
    ));
  };

  useEffect(() => {
    const markTouch = () => {
      touchRef.current = true;
    };
    window.addEventListener('touchstart', markTouch, { passive: true });
    return () => window.removeEventListener('touchstart', markTouch);
  }, []);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const handleTouchStart = (event: TouchEvent) => {
      const card = (event.target as Element | null)?.closest('.landing-card');
      if (!card) return;
      const id = card.getAttribute('href')?.replace('#', '');
      if (id) {
        hoveredRef.current = id;
        setHoveredId(id);
      }
      if (!deck.classList.contains('is-expanded')) {
        event.preventDefault();
        setDeckOpen(true);
      }
    };
    deck.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => deck.removeEventListener('touchstart', handleTouchStart);
  }, []);

  /**
   * The expanded fan is divided into contiguous vertical bands, one per card.
   * Each band starts at its card's left edge, so the pointer always targets the
   * card whose exposed artwork it is over — even after the hovered card lifts
   * above its neighbours.
   */
  const updateHoverFromPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const deck = event.currentTarget;
    const rect = deck.getBoundingClientRect();
    const styles = getComputedStyle(deck);
    const spread = Number.parseFloat(styles.getPropertyValue('--fan-spread')) || 96;
    const scale = Number.parseFloat(styles.getPropertyValue('--fan-scale')) || 0.46;
    const liftPercent = Number.parseFloat(styles.getPropertyValue('--fan-lift')) || 27;
    const arc = Number.parseFloat(styles.getPropertyValue('--fan-arc')) || 14;
    const cardWidth = rect.width * scale;
    const cardHeight = rect.height * scale;
    const lift = (rect.height * liftPercent) / 100;
    const fanTop = rect.top + rect.height - lift - cardHeight;
    const fanBottom = rect.top + rect.height - lift + arc * 2;
    if (event.clientY < fanTop - 10 || event.clientY > fanBottom + 10) return;
    const fanWidth = spread * (deckOrder.length - 1) + cardWidth;
    const fanLeft = rect.left + rect.width / 2 - fanWidth / 2;
    const band = Math.floor((event.clientX - fanLeft) / spread);
    const index = Math.max(0, Math.min(deckOrder.length - 1, band));
    const id = deckOrder[index];
    if (id) updateHovered(id);
  };

  const closeDeck = () => {
    commitHoveredOrder(hoveredRef.current);
    updateHovered(null);
    setDeckOpen(false);
  };

  return (
    <section className="landing" aria-labelledby="landing-title">
      <div className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow landing-eyebrow">SLEDGE · PERSONAL ROSTER</p>
          <h1 id="landing-title" className="landing-title">
            THE FIGHT<br />
            IS PERSONAL.
          </h1>
          <p className="landing-lede">
            A curated archive of the characters, formations, and playstyles that
            define SLEDGE. Enter a fighter to view their dedicated stage, signature
            formation, and personal notes.
          </p>
          <div className="landing-actions">
            <a className="btn btn-primary" href="#jin">
              Enter the roster <span className="arr" aria-hidden="true">→</span>
            </a>
            <a className="btn btn-ghost" href="#roster">
              Browse characters <span className="arr" aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="landing-visual">
          <div className="landing-visual-glow" />
          <div
            ref={deckRef}
            className={`landing-deck${deckOpen ? ' is-expanded' : ''}`}
            onMouseEnter={(event) => {
              setDeckOpen(true);
              updateHoverFromPointer(event);
            }}
            onMouseMove={updateHoverFromPointer}
            onMouseLeave={closeDeck}
            onFocus={() => setDeckOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                closeDeck();
              }
            }}
          >
            {deckOrder.map((id, index) => {
              const character = characters.find((item) => item.id === id);
              if (!character) return null;
              return (
                <a
                  key={character.id}
                  className={`landing-card${hoveredId === character.id ? ' is-hovered' : ''}`}
                  href={`#${character.id}`}
                  style={{ '--i': index } as CSSProperties}
                  data-character={character.id}
                  aria-label={`${character.first} ${character.last}`}
                  onFocus={() => updateHovered(character.id)}
                  onTouchStart={() => {
                    touchRef.current = true;
                  }}
                  onClick={(event) => {
                    updateHovered(character.id);
                    if (touchRef.current && !deckOpen) {
                      event.preventDefault();
                      setDeckOpen(true);
                    }
                    touchRef.current = false;
                  }}
                >
                  <img src={character.image} alt="" loading="lazy" decoding="async" />
                  <span className="landing-card-label">
                    <span className="landing-card-index">{character.index}</span>
                    <span className="landing-card-name">
                      {DECK_NAMES[character.id] ?? character.first}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
          <button
            type="button"
            className="landing-deck-toggle"
            aria-expanded={deckOpen}
            onClick={() => {
              if (deckOpen) {
                commitHoveredOrder(hoveredRef.current);
                updateHovered(null);
              }
              setDeckOpen((value) => !value);
            }}
          >
            {deckOpen ? 'Close deck' : 'Reveal characters'}
          </button>
        </div>
      </div>

      <div className="landing-roster">
        <Roster />
      </div>

      <About />
    </section>
  );
}
