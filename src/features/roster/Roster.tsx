import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { characters, defaultOrder, difficultyRank } from '../../data/characters';
import { filterFacets, sortOptions } from '../../data/filters';
import type { FacetId, SortValue } from '../../data/filters';
import type { Character } from '../../types';

type FacetState = Record<FacetId, string | null>;
const emptyFacets = (): FacetState => ({
  status: null,
  playstyle: null,
  difficulty: null,
  execution: null,
  signature: null,
});
const valueFor = (character: Character, facet: FacetId): string => character[facet];
const signatureLabel = (value: string): string =>
  filterFacets.find((f) => f.id === 'signature')?.options.find((o) => o.value === value)?.label ?? value;

const bySort = (sort: SortValue) => {
  return (a: Character, b: Character): number => {
    switch (sort) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'difficulty':
        return difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || defaultOrder(a, b);
      default:
        return defaultOrder(a, b);
    }
  };
};

export default function Roster() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('default');
  const [values, setValues] = useState<FacetState>(emptyFacets);
  const gridRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery((params.get('q') ?? '').slice(0, 80));
    const sortParam = params.get('sort');
    setSort(sortOptions.some((o) => o.value === sortParam) ? (sortParam as SortValue) : 'default');
    const next = emptyFacets();
    for (const facet of filterFacets) {
      const raw = params.get(facet.param);
      if (raw && facet.options.some((o) => o.value === raw)) next[facet.id] = raw;
    }
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = characters.filter((character) => {
      for (const facet of filterFacets) {
        const wanted = values[facet.id];
        if (wanted && valueFor(character, facet.id) !== wanted) return false;
      }
      if (tokens.length === 0) return true;
      const haystack = [character.name, character.playstyleLabel, signatureLabel(character.signature)]
        .join(' ')
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
    return [...filtered].sort(bySort(sort));
  }, [query, sort, values]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const facet of filterFacets) params.delete(facet.param);
    params.delete('q');
    params.delete('sort');
    const trimmed = query.trim();
    if (trimmed) params.set('q', trimmed);
    for (const facet of filterFacets) {
      const value = values[facet.id];
      if (value) params.set(facet.param, value);
    }
    if (sort !== 'default') params.set('sort', sort);
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }, [query, sort, values]);

  useEffect(() => {
    const active = document.activeElement;
    if (active?.classList.contains('roster-entry') && active.classList.contains('entry-hidden')) {
      const first = gridRef.current?.querySelector<HTMLAnchorElement>('.roster-entry:not(.entry-hidden)');
      (first ?? resultsRef.current)?.focus();
    }
  }, [visible]);

  const ordered = useMemo(() => [...characters].sort(bySort(sort)), [sort]);
  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);
  const isPristine = !query.trim() && sort === 'default' && filterFacets.every((f) => !values[f.id]);

  const toggleValue = (facetId: FacetId, value: string) =>
    setValues((current) => ({ ...current, [facetId]: current[facetId] === value ? null : value }));
  const clearAll = () => {
    setQuery('');
    setSort('default');
    setValues(emptyFacets());
  };
  const pickRandom = () => {
    const pool = visible.length > 0 ? visible : characters;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    window.location.hash = `#${pick.id}`;
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag !== 'A' && tag !== 'BUTTON') return;
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const grid = gridRef.current;
    if (!grid) return;
    const entries = [...grid.querySelectorAll<HTMLAnchorElement>('.roster-entry:not(.entry-hidden)')];
    if (entries.length === 0) return;
    const currentIndex = entries.indexOf(document.activeElement as HTMLAnchorElement);
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % entries.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = currentIndex === -1 ? entries.length - 1 : (currentIndex - 1 + entries.length) % entries.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = entries.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    entries[nextIndex]?.focus();
  };

  const jin = ordered.find((c) => c.id === 'jin');
  const side = ordered.filter((c) => c.id !== 'jin');

  return (
    <section id="roster" className="section roster" aria-labelledby="roster-title">
      <div className="section-head">
        <p className="eyebrow">The Archive</p>
        <h2 id="roster-title" className="section-title">THE<br />ROSTER</h2>
        <p className="section-sub">Open any character to enter the stage.</p>
      </div>

      <div className="controls" id="roster-controls" aria-label="Roster controls">
        <div className="controls-row">
          <label className="search" htmlFor="roster-search">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
              <circle cx="7.2" cy="7.2" r="5.4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M11.5 11.5L15.2 15.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="visually-hidden">Search characters</span>
            <input
              id="roster-search"
              type="search"
              placeholder="Search roster by name, playstyle or signature…"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="controls-right">
            <label className="sort" htmlFor="roster-sort">
              Sort
              <select
                id="roster-sort"
                aria-label="Sort characters"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button className="btn-mini btn-mini--accent" id="roster-shuffle" type="button" onClick={pickRandom}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M1.5 3.5h2.6c1 0 2 .6 3.1 2.3l.7 1.2M1.5 11.5h2.6c1.3 0 2.3-.8 3.4-2.6M13.5 3.5h-2.6c-1 0-2 .6-3.1 2.3M13.5 11.5h-2.6c-1.3 0-2.3-.8-3.4-2.6M13.5 3.5l-1.6-1.6M13.5 3.5l-1.6 1.6M13.5 11.5l-1.6-1.6M13.5 11.5l-1.6 1.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Random pick
            </button>
            <button className="btn-mini" id="roster-clear" type="button" disabled={isPristine} onClick={clearAll}>Clear all</button>
          </div>
        </div>

        <div className="facets" id="facets">
          {filterFacets.map((facet) => (
            <fieldset key={facet.id} className="facet-group">
              <legend>{facet.label}</legend>
              <div className="chip-row">
                {facet.options.map((option) => {
                  const active = values[facet.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="chip"
                      data-facet={facet.id}
                      data-value={option.value}
                      aria-pressed={active}
                      onClick={() => toggleValue(facet.id, option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <p className="results" id="roster-results" role="status" aria-live="polite" tabIndex={-1} ref={resultsRef}>
          Showing {visible.length} of {characters.length} characters
        </p>
        <div className="no-results" id="no-results" hidden={visible.length !== 0}>
          <p>No characters match those filters.</p>
          <button type="button" className="btn-mini btn-mini--accent" id="no-results-reset" onClick={clearAll}>Reset filters</button>
        </div>
      </div>

      <div className="roster-grid" ref={gridRef} onKeyDown={onKeyDown}>
        {jin && (
          <a className={`roster-entry roster-entry--feature${visibleIds.has(jin.id) ? '' : ' entry-hidden'}`} href={`#${jin.id}`}>
            <img className="entry-art" src={jin.image} alt={jin.imageAlt} width={800} height={941} loading="lazy" decoding="async" />
            <span className="entry-info">
              <span className="status-badge" data-status={jin.status}>{jin.statusLabel}</span>
              <span className="entry-index">{jin.index}</span>
              <span className="entry-name">{jin.first}<br />{jin.last}</span>
              <span className="entry-meta"><span><strong>{jin.playstyleLabel}</strong></span><span>{jin.difficultyLabel} difficulty</span></span>
            </span>
          </a>
        )}
        {side.length > 0 && (
          <div className="roster-side">
            {side.map((character) => (
              <a key={character.id} className={`roster-entry roster-entry--row${visibleIds.has(character.id) ? '' : ' entry-hidden'}`} href={`#${character.id}`}>
                <img className="entry-art" src={character.image} alt={character.imageAlt} width={800} height={941} loading="lazy" decoding="async" />
                <span className="entry-info">
                  <span className="status-badge" data-status={character.status}>{character.statusLabel}</span>
                  <span className="entry-index">{character.index}</span>
                  <span className="entry-name">{character.first}<br />{character.last}</span>
                  <span className="entry-meta"><span><strong>{character.playstyleLabel}</strong></span><span>{character.difficultyLabel} difficulty</span></span>
                </span>
                <span className="entry-arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
