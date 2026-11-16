import { activateCssFallback, isReducedMotion, normalizeEnvironment } from './fallback.js';
import { environments } from '../config.js';
import { ART, atmosphereFragmentSource, atmosphereVertexSource } from './shaders.js';
import { createParticles, applyParticleEnv, drawParticles, destroyParticles } from './particles.js';
const TIER_CAPS = {
  tier1: { resScale: 0.25, dprCap: 1.25, octaves: 3, particles: 450, art: 0 },
  tier2: { resScale: 0.5, dprCap: 1.25, octaves: 4, particles: 1100, art: 1 },
  tier3: { resScale: 0.5, dprCap: 1.5, octaves: 5, particles: 2200, art: 1 },
};
const TIER_ORDER = ['tier1', 'tier2', 'tier3'];
const QUALITY_VALUES = ['auto', 'tier0', 'tier1', 'tier2', 'tier3'];
const state = {
  initialized: false,
  environment: normalizeEnvironment(document.body?.dataset.env),
  quality: 'auto',
  entryTier: 'tier2',
  pointer: { x: 0.5, y: 0.5 },
  heroVisible: false,
  disposed: true,
  debug: false,
};
const wipe = { from: null, to: null, start: 0, reseeded: true, active: false };
const ptrW = { x: 0.5, y: 0.5 };
const disp = { deep: [0,0,0], fog: [0,0,0], glow: [0,0,0], vein: [0,0,0], mode: 0 };
const listeners = {
  tierchange: new Set(),
  error: new Set(),
};
function emit(type, payload) {
  for (const cb of listeners[type] ?? []) {
    try {
      cb(payload);
    } catch (error) {
      console.error('fx listener error', error);
    }
  }
}
let gl = null;
let program = null;
let vao = null;
let uniforms = null;
let particles = null;
let particleCount = 0;
let artImg = null, artTex = null, artState = 0;
let canvasEl = null;
let rafId = 0;
let running = false;
let startSeconds = 0;
let frameCount = 0;
let resizeTimer = 0;
let lastTierStepCheck = 0;
const frameDeltas = [];
const avgDelta = () => frameDeltas.reduce((a, b) => a + b, 0) / (frameDeltas.length || 1);
let gpuTimerExt = null;
let gpuQuery = null;
let gpuMsSmoothed = null;
let heroObserver = null;
let dprMedia = null;
const detach = [];
let contextOff = null;
function tierForQuery() {
  try {
    const fx = new URLSearchParams(window.location.search).get('fx');
    if (fx === 'off') return 'tier0';
    if (fx === 'low') return 'tier1';
    if (fx === 'high') return 'tier3';
  } catch {  }
  return 'auto';
}
function detectEntryTier() {
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return 'tier1';
    const cores = navigator.hardwareConcurrency ?? 4;
    if (cores >= 8) return 'tier3';
    if (cores >= 4) return 'tier2';
    return 'tier1';
  } catch {
    return 'tier2';
  }
}
function chooseTier() {
  if (state.quality !== 'auto') return state.quality;
  const forced = tierForQuery();
  if (forced !== 'auto') return forced;
  return detectEntryTier();
}
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}
function buildProgram() {
  const vert = compileShader(gl.VERTEX_SHADER, atmosphereVertexSource);
  const frag = compileShader(gl.FRAGMENT_SHADER, atmosphereFragmentSource);
  const linked = gl.createProgram();
  gl.attachShader(linked, vert);
  gl.attachShader(linked, frag);
  gl.linkProgram(linked);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(linked) || 'unknown link error';
    gl.deleteProgram(linked);
    throw new Error(`program link failed: ${log}`);
  }
  return linked;
}
function locateUniforms() {
  const names = ['uTime', 'uResolution', 'uPointer', 'uWipe', 'uDeep', 'uFog', 'uGlow', 'uVein', 'uOctaves', 'uMode', 'uArtRect'];
  const map = {};
  for (const name of names) map[name] = gl.getUniformLocation(program, name);
  return map;
}
function artInit() {
  const T = gl.TEXTURE_2D;
  artTex = gl.createTexture();
  gl.bindTexture(T, artTex);
  gl.texImage2D(T, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(T, k, v);
  gl.generateMipmap(T);
}
function artLoad() {
  if (artState) return;
  const T = gl.TEXTURE_2D;
  if (!artImg) artImg = document.querySelector('#jin img');
  if (!artImg || !artImg.complete) return;
  if (!artImg.naturalWidth) { artState = -1; return; }
  gl.bindTexture(T, artTex);
  gl.texImage2D(T, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artImg);
  gl.generateMipmap(T);
  artState = 1;
}
function artFrame() {
  const on = ART && state.environment === 'jin' && TIER_CAPS[state.entryTier]?.art === 1;
  if (on && !artState) artLoad();
  if (!on || artState !== 1) return gl.uniform4f(uniforms.uArtRect, 0, 0, 0, 0);
  const r = artImg.getBoundingClientRect(), w = canvasEl.clientWidth, h = canvasEl.clientHeight;
  gl.uniform4f(uniforms.uArtRect, r.left / w, 1 - (r.top + r.height) / h, r.width / w, r.height / h);
}
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const copy = (d, s) => { d.deep = [...s.deep]; d.fog = [...s.fog]; d.glow = [...s.glow]; d.vein = [...s.vein]; d.mode = s.mode; };
function flushEnv() {
  gl.useProgram(program);
  gl.uniform3fv(uniforms.uDeep, disp.deep);
  gl.uniform3fv(uniforms.uFog, disp.fog);
  gl.uniform3fv(uniforms.uGlow, disp.glow);
  gl.uniform3fv(uniforms.uVein, disp.vein);
  gl.uniform1i(uniforms.uMode, disp.mode);
}
function applyEnvironment(env) {
  copy(disp, env);
  flushEnv();
  if (particles) applyParticleEnv(gl, particles, env);
}
function applyTierCaps(tier) {
  const caps = TIER_CAPS[tier];
  state.entryTier = tier;
  particleCount = caps.particles;
  if (program) gl.useProgram(program);
  gl.uniform1i(uniforms.uOctaves, caps.octaves);
  resizeBackingStore(caps);
}
function resizeBackingStore(caps = TIER_CAPS[state.entryTier]) {
  if (!gl || !canvasEl) return;
  if (program) gl.useProgram(program);
  const cssW = Math.max(1, canvasEl.clientWidth || window.innerWidth);
  const cssH = Math.max(1, canvasEl.clientHeight || window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, caps.dprCap);
  const w = Math.max(1, Math.floor(cssW * dpr * caps.resScale));
  const h = Math.max(1, Math.floor(cssH * dpr * caps.resScale));
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
    gl.viewport(0, 0, w, h);
  } else {
    gl.viewport(0, 0, w, h);
  }
  gl.uniform2f(uniforms.uResolution, w, h);
  if (particles) {
    gl.useProgram(particles.program);
    gl.uniform1f(particles.u.uAspect, w / h);
  }
}
function teardownGl(lost) {
  cancelAnimationFrame(rafId);
  rafId = 0;
  running = false;
  frameCount = 0;
  frameDeltas.length = 0;
  wipe.active = false;
  gpuQuery = null;
  gpuMsSmoothed = null;
  if (gl && !lost) {
    if (particles) destroyParticles(gl, particles);
    if (program) gl.deleteProgram(program);
    if (vao) gl.deleteVertexArray(vao);
    if (artTex) gl.deleteTexture(artTex);
  }
  particles = null;
  particleCount = 0;
  program = null;
  vao = null;
  uniforms = null;
  artTex = null;
  artState = 0;
  gl = null;
}
function hookContext(c) {
  if (contextOff) return;
  const add = (n, f) => (c.addEventListener(n, f), () => c.removeEventListener(n, f));
  const a = add('webglcontextlost', onContextLost), b = add('webglcontextrestored', onContextRestored);
  contextOff = () => { a(); b(); };
}
function detachAll() {
  heroObserver?.disconnect();
  heroObserver = null;
  dprMedia?.removeEventListener?.('change', onDprChange);
  dprMedia = null;
  while (detach.length) {
    const off = detach.pop();
    try { off(); } catch {  }
  }
  window.clearTimeout(resizeTimer);
}
function onDprChange() {
  resizeBackingStore();
}
function onWindowResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => resizeBackingStore(), 150);
}
function onVisibilityChange() {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
  } else {
    startLoop();
  }
}
function onPageHide() {
  dispose();
}
function onContextLost(event) {
  event.preventDefault();
  teardownGl(1);
  detachAll();
  if (state.quality !== 'tier0') state.initialized = false;
  canvasEl?.classList.remove('fx-canvas--live');
  activateCssFallback('context-lost');
  emit('tierchange', { tier: 'tier0', reason: 'context-lost' });
}
function onContextRestored() {
  if (state.disposed || state.quality === 'tier0') return;
  state.initialized = true;
  void bootBackend('restored');
}
function startLoop() {
  if (running || document.hidden || !gl) return;
  running = true;
  let last = performance.now();
  const frame = (now) => {
    if (!running || document.hidden) return;
    rafId = requestAnimationFrame(frame);
    const delta = now - last;
    last = now;
    frameDeltas.push(delta);
    if (frameDeltas.length > 90) frameDeltas.shift();
    if (state.debug && frameCount > 0 && frameCount % 240 === 0) {
      const avg = avgDelta();
      console.debug(`[fx] tier=${state.entryTier} cpu-interval-avg=${avg.toFixed(2)}ms (not GPU time) gpu-ms=${gpuMsSmoothed?.toFixed(3) ?? 'unsupported'}`);
    }
    governTier(now);
    if (wipe.active) {
      const k = Math.min(1, (now - wipe.start) / 380);
      const ease = 1 - Math.pow(1 - k, 3);
      disp.deep = lerp3(wipe.from.deep, wipe.to.deep, ease);
      disp.fog = lerp3(wipe.from.fog, wipe.to.fog, ease);
      disp.glow = lerp3(wipe.from.glow, wipe.to.glow, ease);
      disp.vein = lerp3(wipe.from.vein, wipe.to.vein, ease);
      disp.mode = k < 0.5 ? wipe.from.mode : wipe.to.mode;
      flushEnv();
      gl.uniform1f(uniforms.uWipe, k);
      if (k >= 0.5 && !wipe.reseeded) { if (particles) applyParticleEnv(gl, particles, wipe.to); wipe.reseeded = true; }
      if (k >= 1) wipe.active = false;
    }
    const px = state.pointer.x, py = state.pointer.y;
    const dxp = px - ptrW.x, dyp = py - ptrW.y;
    if (Math.abs(dxp) > 0.002 || Math.abs(dyp) > 0.002) {
      ptrW.x += dxp * (1 - Math.exp(-((delta || 16) / 1000) * 6));
      ptrW.y += dyp * (1 - Math.exp(-((delta || 16) / 1000) * 6));
      if (gl && uniforms) {
        if (particles) {
          gl.useProgram(particles.program);
          gl.uniform2f(particles.u.uPointer, ptrW.x, ptrW.y);
        }
        gl.useProgram(program);
        gl.uniform2f(uniforms.uPointer, ptrW.x, ptrW.y);
      }
      document.documentElement.style.setProperty('--pdx', ((ptrW.x - 0.5) * 2).toFixed(3));
      document.documentElement.style.setProperty('--pdy', ((ptrW.y - 0.5) * 2).toFixed(3));
      document.documentElement.style.setProperty('--rim-g', Math.max(0, 1 - Math.hypot(ptrW.x - 0.5, ptrW.y - 0.55) / 0.8).toFixed(3));
    }
    if (!state.heroVisible) return;
    if (gpuTimerExt && frameCount % 60 === 30) {
      gpuQuery = gl.createQuery();
      gl.beginQuery(gpuTimerExt.TIME_ELAPSED_EXT, gpuQuery);
    }
    if (gpuTimerExt && gpuQuery && frameCount % 60 === 31) {
      gl.endQuery(gpuTimerExt.TIME_ELAPSED_EXT);
    }
    if (gpuTimerExt && gpuQuery && frameCount % 60 === 33 && gl.getQueryParameter(gpuQuery, gl.QUERY_RESULT_AVAILABLE)) {
      const ns = gl.getQueryParameter(gpuQuery, gl.QUERY_RESULT);
      const ms = ns / 1e6;
      gpuMsSmoothed = gpuMsSmoothed == null ? ms : gpuMsSmoothed * 0.75 + ms * 0.25;
      gl.deleteQuery(gpuQuery);
      gpuQuery = null;
    }
    const tSec = ((now - startSeconds) / 1000) % 3600;
    gl.useProgram(program);
    gl.uniform1f(uniforms.uTime, tSec);
    artFrame();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (particles && particleCount > 0) drawParticles(gl, particles, tSec, particleCount);
    frameCount += 1;
  };
  rafId = requestAnimationFrame(frame);
}
function governTier(now) {
  if (frameDeltas.length < 90) return;
  if (now - lastTierStepCheck < 900) return;
  const avg = avgDelta();
  const idx = TIER_ORDER.indexOf(state.entryTier);
  if (avg > 24 && idx > 0) {
    lastTierStepCheck = now;
    applyTierCaps(TIER_ORDER[idx - 1]);
    frameDeltas.length = 0;
    emit('tierchange', { tier: state.entryTier, reason: 'governor-step-down' });
  } else if (avg < 12 && idx < TIER_ORDER.length - 1) {
    lastTierStepCheck = now;
    applyTierCaps(TIER_ORDER[idx + 1]);
    frameDeltas.length = 0;
    emit('tierchange', { tier: state.entryTier, reason: 'governor-step-up' });
  } else {
    lastTierStepCheck = now;
  }
}
function ensureHeroObserver() {
  heroObserver?.disconnect();
  state.heroVisible = true;
  if (canvasEl) canvasEl.style.opacity = '1';
  const hero = document.querySelector('main');
  if (!hero || typeof IntersectionObserver === 'undefined') return;
  heroObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        state.heroVisible = entry.isIntersecting;
        if (canvasEl) canvasEl.style.opacity = state.heroVisible ? '1' : '0';
      }
    },
    { threshold: [0, 0.08, 0.5] },
  );
  heroObserver.observe(hero);
}
async function bootBackend(reason = 'init') {
  detachAll();
  const tier = chooseTier();
  if (tier === 'tier0') {
    activateCssFallback('fx-off');
    emit('tierchange', { tier: 'tier0', reason: 'fx-off' });
    return { ok: true, tier: 'tier0', reason: 'fx-off' };
  }
  const canvas = canvasEl;
  if (!canvas) {
    activateCssFallback('no-canvas');
    emit('tierchange', { tier: 'tier0', reason: 'no-canvas' });
    return { ok: true, tier: 'tier0', reason: 'no-canvas' };
  }
  let context = null;
  try {
    context = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
  } catch (error) {
    context = null;
    console.warn('webgl2 context creation threw', error);
  }
  if (!context) {
    activateCssFallback('webgl2-unavailable');
    emit('tierchange', { tier: 'tier0', reason: 'webgl2-unavailable' });
    return { ok: true, tier: 'tier0', reason: 'webgl2-unavailable' };
  }
  gl = context;
  try {
    program = buildProgram();
    gl.useProgram(program);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    uniforms = locateUniforms();
    if (ART) artInit();
    gl.uniform2f(uniforms.uResolution, 1, 1);
    gl.uniform1f(uniforms.uTime, 0);
    gl.uniform2f(uniforms.uPointer, 0.5, 0.5);
    gl.uniform1f(uniforms.uWipe, 1.0);
    particles = createParticles(gl);
    applyEnvironment(environments[normalizeEnvironment(state.environment)] ?? environments.jin);
    applyTierCaps(TIER_ORDER.includes(tier) ? tier : 'tier2');
    gpuTimerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  } catch (error) {
    console.error('fx backend init failed; Tier 0 engaged', error);
    teardownGl();
    detachAll();
    state.initialized = false;
    activateCssFallback('shader-error');
    emit('error', { reason: 'shader-error', message: String(error?.message || error) });
    emit('tierchange', { tier: 'tier0', reason: 'shader-error' });
    return { ok: true, tier: 'tier0', reason: 'shader-error' };
  }
  hookContext(canvas);
  window.addEventListener('resize', onWindowResize);
  detach.push(() => window.removeEventListener('resize', onWindowResize));
  document.addEventListener('visibilitychange', onVisibilityChange);
  detach.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  window.addEventListener('pagehide', onPageHide);
  detach.push(() => window.removeEventListener('pagehide', onPageHide));
  if (!window.matchMedia?.('(pointer: coarse)').matches) {
    const onPointerMove = (e) => {
      state.pointer.x = e.clientX / window.innerWidth;
      state.pointer.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    detach.push(() => window.removeEventListener('pointermove', onPointerMove));
  }
  try {
    dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMedia.addEventListener?.('change', onDprChange);
  } catch {
    dprMedia = null;
  }
  ensureHeroObserver();
  startSeconds = performance.now();
  canvasEl.classList.add('fx-canvas--live');
  document.body.dataset.fx = 'webgl';
  document.body.dataset.fxReason = state.entryTier;
  startLoop();
  emit('tierchange', { tier: state.entryTier, reason });
  return { ok: true, tier: state.entryTier, reason };
}
async function initialize(canvas) {
  if (state.initialized) return { ok: true, tier: state.entryTier, reason: 'already-initialized' };
  state.disposed = false;
  canvasEl = canvas ?? document.getElementById('fx');
  state.debug = false;
  try {
    state.debug = new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    state.debug = false;
  }
  const reduced = isReducedMotion();
  if (reduced) {
    state.initialized = true;
    activateCssFallback('reduced-motion');
    emit('tierchange', { tier: 'tier0', reason: 'reduced-motion' });
    return { ok: true, tier: 'tier0', reason: 'reduced-motion' };
  }
  state.initialized = true;
  const result = await bootBackend('init');
  return result;
}
function setEnvironment(id) {
  const env = normalizeEnvironment(id);
  const same = state.environment === env;
  state.environment = env;
  document.body.dataset.env = env;
  if (gl && !same) {
    wipe.from = { deep: [...disp.deep], fog: [...disp.fog], glow: [...disp.glow], vein: [...disp.vein], mode: disp.mode };
    wipe.to = environments[env] ?? environments.jin;
    wipe.start = performance.now();
    wipe.reseeded = false;
    wipe.active = true;
    if (uniforms) { gl.useProgram(program); gl.uniform1f(uniforms.uWipe, 0); }
  }
  return env;
}
function setPointer(xNorm, yNorm) {
  state.pointer.x = clamp01(xNorm);
  state.pointer.y = clamp01(yNorm);
  if (gl && uniforms) {
    if (particles) {
      gl.useProgram(particles.program);
      gl.uniform2f(particles.u.uPointer, state.pointer.x, state.pointer.y);
    }
    gl.useProgram(program);
    gl.uniform2f(uniforms.uPointer, state.pointer.x, state.pointer.y);
  }
}
function setQuality(tier) {
  if (!QUALITY_VALUES.includes(tier)) tier = 'auto';
  state.quality = tier;
  if (tier === 'tier0') {
    teardownGl();
    detachAll();
    document.body.dataset.fx = 'css';
    document.body.dataset.fxReason = 'fx-off';
    canvasEl?.classList.remove('fx-canvas--live');
    emit('tierchange', { tier: 'tier0', reason: 'fx-off' });
    return;
  }
  if (tier !== 'auto' && !gl) {
    if (!state.disposed && state.initialized) void bootBackend('quality');
    return;
  }
  if (tier !== 'auto' && gl) {
    applyTierCaps(tier);
    frameDeltas.length = 0;
  }
}
function resize() {
  resizeBackingStore();
}
function dispose() {
  state.disposed = true;
  teardownGl();
  detachAll();
  contextOff?.();
  contextOff = null;
  state.initialized = false;
  document.body.dataset.fx = 'css';
  document.body.dataset.fxReason = 'disposed';
  canvasEl?.classList.remove('fx-canvas--live');
}
function on(event, callback) {
  const bucket = listeners[event];
  if (!bucket) return () => {};
  bucket.add(callback);
  return () => bucket.delete(callback);
}
const renderer = Object.freeze({
  initialize,
  setEnvironment,
  setPointer,
  setQuality,
  resize,
  dispose,
  on,
});
const clamp01 = (value) => (Number.isNaN(Number(value)) ? 0.5 : Math.min(1, Math.max(0, Number(value))));
export { renderer, createRenderer };
function createRenderer() { return renderer; }
const boot = () => {
  const canvas = document.getElementById('fx');
  const kickoff = () => initialize(canvas);
  if ('requestIdleCallback' in window) window.requestIdleCallback(kickoff, { timeout: 1500 });
  else window.setTimeout(kickoff, 250);
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('load', boot, { once: true });
  }, { once: true });
} else if (document.readyState === 'interactive') {
  window.addEventListener('load', boot, { once: true });
} else {
  boot();
}
