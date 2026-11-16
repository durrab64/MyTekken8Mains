/**
 * SLEDGE — roster archive: search / facets / sort / clear-all /
 * URL-sync / arrow keys / shuffle. Progressive enhancement:
 * without JS the roster is a static list of hash links.
 */
import { characters, difficultyRank, defaultOrder } from './characters.js';
import { filterFacets, sortOptions } from './config.js';
const section = document.getElementById('roster');
if (section) {
  const entries = [...section.querySelectorAll('.roster-entry')];
  const entryById = new Map(entries.map((el) => [el.getAttribute('href').slice(1), el]));
  const grid = section.querySelector('.roster-grid');
  const searchInput = document.getElementById('roster-search');
  const sortSelect = document.getElementById('roster-sort');
  const clearBtn = document.getElementById('roster-clear');
  const shuffleBtn = document.getElementById('roster-shuffle');
  const results = document.getElementById('roster-results');
  const noResults = document.getElementById('no-results');
  const noResultsReset = document.getElementById('no-results-reset');
  const facetsHost = document.getElementById('facets');
  const pristine = () => ({
    q: '',
    sort: 'default',
    values: Object.fromEntries(filterFacets.map((f) => [f.id, null])),
  });
  const state = pristine();
  if (facetsHost) {
    const fragment = document.createDocumentFragment();
    for (const facet of filterFacets) {
      const group = document.createElement('fieldset');
      group.className = 'facet-group';
      const legend = document.createElement('legend');
      legend.textContent = facet.label;
      group.appendChild(legend);
      const row = document.createElement('div');
      row.className = 'chip-row';
      for (const option of facet.options) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.facet = facet.id;
        chip.dataset.value = option.value;
        chip.textContent = option.label;
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', () => toggleFacet(facet.id, option.value));
        row.appendChild(chip);
      }
      group.appendChild(row);
      fragment.appendChild(group);
    }
    facetsHost.appendChild(fragment);
  }
  if (sortSelect) {
    for (const option of sortOptions) {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = option.label;
      sortSelect.appendChild(el);
    }
  }
  const signatureLabel = (v) =>
    filterFacets.find((f) => f.id === 'signature')?.options.find((o) => o.value === v)?.label ?? v;
  function visibleCharacters() {
    const q = state.q.trim().toLowerCase();
    return characters.filter((c) => {
      for (const facet of filterFacets) {
        const wanted = state.values[facet.id];
        if (wanted && c[facet.id] !== wanted) return false;
      }
      if (!q) return true;
      const haystack = [c.name, c.playstyle, signatureLabel(c.signature)].join(' ').toLowerCase();
      return q.split(/\s+/).every((token) => haystack.includes(token));
    });
  }
  function sortList(list) {
    const sorted = [...list];
    switch (state.sort) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'difficulty':
        sorted.sort(
          (a, b) =>
            (difficultyRank[a.difficulty] ?? 99) - (difficultyRank[b.difficulty] ?? 99) ||
            defaultOrder(a, b),
        );
        break;
      default:
        sorted.sort(defaultOrder);
    }
    return sorted;
  }
  function reorderDom(orderedIds) {
    const current = [...grid.querySelectorAll('.roster-entry')].map((el) => el.getAttribute('href').slice(1));
    if (current.length === orderedIds.length && current.every((id, i) => id === orderedIds[i])) {
      return; // no churn if already correct
    }
    const fragment = document.createDocumentFragment();
    for (const id of orderedIds) {
      const el = entryById.get(id);
      if (el) fragment.appendChild(el);
    }
    grid.appendChild(fragment);
  }
  const isPristine = () =>
    !state.q.trim() &&
    state.sort === 'default' &&
    filterFacets.every((f) => !state.values[f.id]);
  function apply() {
    const visible = sortList(visibleCharacters());
    const orderedIds = visible.map((c) => c.id);
    const visibleIds = new Set(orderedIds);
    for (const [id, el] of entryById) {
      el.classList.toggle('entry-hidden', !visibleIds.has(id));
    }
    reorderDom(orderedIds);
    if (results) {
      results.textContent = `Showing ${visible.length} of ${characters.length} characters`;
    }
    if (noResults) {
      noResults.hidden = visible.length !== 0;
    }
    for (const chip of section.querySelectorAll('.chip')) {
      const active = state.values[chip.dataset.facet] === chip.dataset.value;
      chip.setAttribute('aria-pressed', String(active));
    }
    if (sortSelect && sortSelect.value !== state.sort) sortSelect.value = state.sort;
    if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
    if (clearBtn) clearBtn.disabled = isPristine();
    rescueFocusIfHidden();
    syncUrl();
  }
  function toggleFacet(facetId, value) {
    state.values[facetId] = state.values[facetId] === value ? null : value;
    apply();
  }
  function clearAll() {
    Object.assign(state, pristine());
    apply();
  }
  function syncUrl() {
    // keep foreign params (?fx=, ?debug=1) — spec documents ?fx= as manual override
    const params = new URLSearchParams(window.location.search);
    for (const facet of filterFacets) params.delete(facet.param);
    params.delete('q');
    params.delete('sort');
    if (state.q.trim()) params.set('q', state.q.trim());
    for (const facet of filterFacets) {
      const value = state.values[facet.id];
      if (value) params.set(facet.param, value);
    }
    if (state.sort !== 'default') params.set('sort', state.sort);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }
  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    state.q = (params.get('q') || '').slice(0, 80);
    const sortParam = params.get('sort');
    state.sort = sortOptions.some((o) => o.value === sortParam) ? sortParam : 'default';
    for (const facet of filterFacets) {
      const raw = params.get(facet.param);
      state.values[facet.id] = facet.options.some((o) => o.value === raw) ? raw : null;
    }
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.q = searchInput.value;
      apply();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      apply();
    });
  }
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (noResultsReset) noResultsReset.addEventListener('click', clearAll);
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      const visible = visibleCharacters();
      const pool = visible.length > 0 ? visible : characters;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      window.location.hash = `#${pick.id}`;
    });
  }
  section.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName;
    if (tag !== 'A' && tag !== 'BUTTON') return;
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const visible = [...grid.querySelectorAll('.roster-entry:not(.entry-hidden)')];
    if (visible.length === 0) return;
    const currentIndex = visible.indexOf(document.activeElement);
    let nextIndex = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % visible.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = currentIndex === -1 ? visible.length - 1 : (currentIndex - 1 + visible.length) % visible.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = visible.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    visible[nextIndex].focus();
  });
  function rescueFocusIfHidden() {
    const active = document.activeElement;
    if (active?.classList?.contains('roster-entry') && active.classList.contains('entry-hidden')) {
      const firstVisible = grid.querySelector('.roster-entry:not(.entry-hidden)');
      if (firstVisible) firstVisible.focus();
      else results?.focus();
    }
  }
  readUrl();
  apply();
}
