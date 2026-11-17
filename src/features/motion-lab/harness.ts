/**
 * Lab-only measurement shims. Loaded before React so they can replace rAF and
 * matchMedia before the engine reads them. Never imported by production code.
 *
 *   ?rafshim  setTimeout-driven rAF, matching the existing measurement harness
 *             used when the desktop window is occluded/throttled.
 *   ?reduce   forces prefers-reduced-motion: reduce without OS settings.
 */

const params = new URLSearchParams(window.location.search);

if (params.has('rafshim')) {
  const pending = new Map<number, number>();
  let sequence = 0;

  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = ++sequence;
    const timeout = window.setTimeout(() => {
      pending.delete(id);
      callback(performance.now());
    }, 16);
    pending.set(id, timeout);
    return id;
  };

  window.cancelAnimationFrame = (id: number): void => {
    const timeout = pending.get(id);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      pending.delete(id);
    }
  };
}

if (params.has('reduce')) {
  const originalMatchMedia = window.matchMedia.bind(window);

  window.matchMedia = ((query: string): MediaQueryList => {
    if (!query.includes('prefers-reduced-motion')) {
      return originalMatchMedia(query);
    }

    return {
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList;
  }) as typeof window.matchMedia;
}

// Test-only capability removal so the analytic fallback and the timer's
// "unavailable" state can be verified on hardware that supports both.
if (
  (params.has('nofloat') || params.has('notimer')) &&
  typeof WebGL2RenderingContext !== 'undefined'
) {
  const originalGetExtension = WebGL2RenderingContext.prototype.getExtension;
  WebGL2RenderingContext.prototype.getExtension = function getExtension(
    this: WebGL2RenderingContext,
    name: string,
  ): unknown {
    if (params.has('nofloat') && name === 'EXT_color_buffer_float') {
      return null;
    }
    if (params.has('notimer') && name === 'EXT_disjoint_timer_query_webgl2') {
      return null;
    }
    return originalGetExtension.call(this, name);
  } as typeof WebGL2RenderingContext.prototype.getExtension;
}
