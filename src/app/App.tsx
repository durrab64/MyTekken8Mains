import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Hero from '../components/Hero';
import About from '../components/About';
import Roster from '../features/roster/Roster';
import Stage from '../features/character/Stage';
import { characters } from '../data/characters';
import { createRenderer } from '../graphics/engine';
import type { Renderer, FxTierchangeEvent } from '../graphics/engine';
import { normalizeEnvironment } from '../graphics/fallback';
import type { CharacterId } from '../graphics/fallback';
import { atmosphereFragmentSource, atmosphereVertexSource } from '../graphics/shaders';

export default function App() {
  const rendererRef = useRef<Renderer | null>(null);
  if (rendererRef.current === null) {
    rendererRef.current = createRenderer();
  }
  const renderer = rendererRef.current;

  const [activeId, setActiveId] = useState<CharacterId>(() =>
    normalizeEnvironment(window.location.hash.slice(1)),
  );

  useEffect(() => {
    const onHashChange = () => {
      setActiveId(normalizeEnvironment(window.location.hash.slice(1)));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!renderer) return;
    const canvas = document.getElementById('fx') as HTMLCanvasElement | null;
    void renderer.initialize(canvas);
    return () => {
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!renderer) return;
    document.body.dataset.env = activeId;
    renderer.setEnvironment(activeId);
    const heading = document.querySelector<HTMLHeadingElement>(`#${activeId} h2`);
    heading?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!renderer) return;
    return renderer.on('tierchange', (payload) => {
      const event = payload as FxTierchangeEvent;
      if (import.meta.env.DEV) {
        console.debug('[renderer]', event.tier, event.reason);
      }
    });
  }, [renderer]);

  const testHooks =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('test');
  if (testHooks) {
    (window as unknown as { __renderer: Renderer }).__renderer = renderer;
    (window as unknown as { __shaders: { atmosphereFragmentSource: string; atmosphereVertexSource: string } }).__shaders = {
      atmosphereFragmentSource,
      atmosphereVertexSource,
    };
  }

  return (
    <>
      <canvas id="fx" className="fx-canvas" aria-hidden="true" />
      <a className="skip-link" href="#roster">Skip to the roster</a>
      <Header />
      <main id="top">
        <Hero />
        <Roster />
        {characters.map((character) => (
          <Stage key={character.id} character={character} active={character.id === activeId} />
        ))}
        <About />
      </main>
      <Footer />
    </>
  );
}
