import { useEffect, useState } from 'react';
import type { Character } from '../../types';

export default function Stage({ character, active }: { character: Character; active: boolean }) {
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (!active) return;
    setEntering(true);
    const timer = window.setTimeout(() => setEntering(false), 400);
    return () => window.clearTimeout(timer);
  }, [active]);

  const classes = [
    'stage',
    `stage--${character.id}`,
    character.flip ? 'stage--flip' : '',
    entering ? 'is-entering' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section id={character.id} className={classes} aria-labelledby={`${character.id}-name`}>
      <div className="stage-inner">
        <div className="stage-art">
          <img src={character.image} alt={character.imageAlt} width={800} height={941} loading="lazy" decoding="async" />
        </div>
        <div className="stage-body">
          <p className="eyebrow stage-eyebrow">{character.statusLabel}</p>
          <h2 id={`${character.id}-name`} className="stage-name" tabIndex={-1}>
            {character.first}
            <br />
            {character.last}
          </h2>
          <p className="stage-why">{character.why}</p>
          <dl className="spec-sheet">
            <div><dt>Status</dt><dd>{character.statusLabel}</dd></div>
            <div><dt>Playstyle</dt><dd>{character.playstyleLabel}</dd></div>
            <div><dt>Difficulty</dt><dd>{character.difficultyLabel}</dd></div>
            <div><dt>Execution</dt><dd>{character.executionLabel}</dd></div>
            <div><dt>Signature</dt><dd>{character.signatureLabel}</dd></div>
          </dl>
          <nav className="stage-nav" aria-label="Character stages">
            <a rel="prev" href={`#${character.prev}`}>&larr; {character.prevLabel}</a>
            <span className="stage-index" aria-hidden="true">{character.index} / 05</span>
            <a rel="next" href={`#${character.next}`}>{character.nextLabel} &rarr;</a>
          </nav>
        </div>
      </div>
    </section>
  );
}
