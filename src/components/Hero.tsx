import type { CharacterId } from '../graphics/fallback';
import type { FormationId } from '../graphics/formation';
import { characters } from '../data/characters';

const FORMATION_NAMES: Record<FormationId, string> = {
  jin: 'Ember Pillar',
  claudio: 'Radiant Orbit',
  dragunov: 'Frost Curtain',
  victor: 'Precision Dial',
  lars: 'Bolt Filament',
};

/**
 * Cinematic hero composition.
 *
 * Desktop: dominant character artwork on the left, a dedicated formation
 * field on the right. The dossier (name, description, fighting identity,
 * difficulty, playstyle, signature, CTA) sits below both.
 *
 * The WebGL canvas itself stays full-bleed behind the page; the renderer
 * clips the particle pass to the element marked `data-fx-region="hero"`,
 * so the formation reads as a field beside the character rather than a
 * page-wide background. One canvas, one renderer, one RAF loop.
 */
export default function Hero({ activeId }: { activeId: CharacterId }) {
  const character = characters.find((c) => c.id === activeId) || characters[0];
  const formationName = FORMATION_NAMES[activeId as FormationId];

  return (
    <section id={activeId} className="hero" data-character={activeId} aria-labelledby="hero-title">
      <div className="hero-env" aria-hidden="true" />

      <div className="hero-inner">
        <div className="hero-artwork">
          <img
            src={character.image}
            alt={character.imageAlt}
            width={800}
            height={941}
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="hero-formation" data-fx-region="hero">
          <div className="hero-formation-meta">
            <span className="hero-formation-kicker">Signature formation</span>
            <span className="hero-formation-name">{formationName}</span>
          </div>
        </div>
      </div>

      <div className="hero-below">
        <div className="hero-dossier">
          <p className="eyebrow hero-below-eyebrow">Tekken 8 · Personal roster</p>
          <h1 id="hero-title" className="hero-name">
            <span className="hero-name-line">{character.first}</span>
            <span className="hero-name-line hero-name-line--last">{character.last}</span>
          </h1>
          <p className="hero-impression">{character.why}</p>
        </div>

        <div className="hero-facts">
          <dl className="hero-spec">
            <div>
              <dt>Status</dt>
              <dd>{character.statusLabel}</dd>
            </div>
            <div>
              <dt>Playstyle</dt>
              <dd>{character.playstyleLabel}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>{character.difficultyLabel}</dd>
            </div>
            <div>
              <dt>Signature</dt>
              <dd>{character.signatureLabel}</dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd>{character.executionLabel}</dd>
            </div>
          </dl>

          <nav className="hero-cta" aria-label="Character stages">
            <a className="btn btn-ghost" href="#">
              Back to roster <span className="arr" aria-hidden="true">←</span>
            </a>
            <a className="btn btn-ghost" rel="prev" href={`#${character.prev}`}>
              <span className="arr" aria-hidden="true">←</span> {character.prevLabel}
            </a>
            <a className="btn btn-primary" rel="next" href={`#${character.next}`}>
              {character.nextLabel} <span className="arr" aria-hidden="true">→</span>
            </a>
          </nav>
        </div>
      </div>
    </section>
  );
}
