import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MotionLabEngine } from './engine/MotionLabEngine';
import {
  FORMATIONS,
  FORMATION_ORDER,
  GPGPU_BYTES,
  TIER_CONFIG,
} from './engine/formations';
import type { FormationId } from './engine/formations';
import {
  DEFAULT_PARAMS,
  PARAM_LIMITS,
  isActiveTier,
} from './types';
import type { LabParams, LabStats, ParticleStateSummary, Tier } from './types';

interface TierOption {
  tier: Tier;
  name: string;
  detail: string;
}

const TIER_OPTIONS: TierOption[] = [
  { tier: 0, name: 'Static', detail: 'CSS only' },
  { tier: 1, name: 'Lite', detail: '450 particles' },
  { tier: 2, name: 'Balanced', detail: '1,100 particles' },
  { tier: 3, name: 'Full', detail: '2,200 particles' },
];

interface ParamControl {
  key: keyof LabParams;
  label: string;
  step: number;
  digits: number;
}

const PARAM_CONTROLS: ParamControl[] = [
  { key: 'pointerStrength', label: 'Pointer force', step: 0.1, digits: 1 },
  { key: 'pointerRadius', label: 'Pointer radius', step: 0.01, digits: 2 },
  { key: 'pointerSwirl', label: 'Pointer swirl', step: 0.1, digits: 1 },
  { key: 'spring', label: 'Spring', step: 0.1, digits: 1 },
  { key: 'damping', label: 'Damping', step: 0.1, digits: 1 },
  { key: 'localDamping', label: 'Local damping', step: 0.1, digits: 1 },
  { key: 'curl', label: 'Ambient curl', step: 0.05, digits: 2 },
  { key: 'amplitude', label: 'Intensity', step: 0.05, digits: 2 },
];

type Tone = 'default' | 'pass' | 'warn' | 'fail' | 'muted';

interface MetricRowProps {
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: string;
  stack?: boolean;
}

function MetricRow({
  label,
  value,
  tone = 'default',
  hint,
  stack = false,
}: MetricRowProps) {
  return (
    <div className={`lab-row${stack ? ' lab-row--stack' : ''}`}>
      <dt>{label}</dt>
      <dd data-tone={tone}>
        {value}
        {hint ? <span className="lab-row__hint">{hint}</span> : null}
      </dd>
    </div>
  );
}

interface NoticeProps {
  tone: 'info' | 'warn' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

function Notice({ tone, title, children, action }: NoticeProps) {
  return (
    <div
      className="lab-notice"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <strong>{title}</strong>
      {children}
      {action ? <div className="lab-actions">{action}</div> : null}
    </div>
  );
}

interface MotionLabTestHooks {
  getStats: () => LabStats | null;
  getCapabilities: () => LabStats['capabilities'] | null;
  getGpuSamples: () => number[];
  getFrameSamples: () => number[];
  getParticleState: () => ParticleStateSummary | null;
  clearGpuSamples: () => void;
  clearFrameSamples: () => void;
  setTier: (tier: Tier) => void;
  setFormation: (id: string) => boolean;
  setParams: (params: Partial<LabParams>) => void;
  setPaused: (paused: boolean) => void;
  setResolutionScale: (scale: number) => void;
  reset: () => boolean;
  loseContext: () => boolean;
  restoreContext: () => boolean;
  checkGlError: () => string | null;
  getState: () => {
    tier: Tier;
    formation: FormationId;
    reducedMotion: boolean;
    mode: 'gpu' | 'css';
    paused: boolean;
    resolutionScale: number;
    engineError: string | null;
  };
}

function formatNumber(
  value: number | null,
  digits = 2,
  suffix = '',
): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function gpuStatus(
  stats: LabStats | null,
  cssMode: boolean,
): {
  value: string;
  tone: Tone;
  hint?: string;
} {
  if (!stats) {
    return cssMode
      ? {
          value: 'unavailable',
          tone: 'muted',
          hint: 'Tier 0 performs no GPU work',
        }
      : { value: 'initializing…', tone: 'muted' };
  }
  switch (stats.gpuStatus) {
    case 'ok':
      return {
        value: formatNumber(stats.gpuMedianMs, 2, ' ms'),
        tone: 'pass',
        hint:
          stats.gpuMs === null
            ? 'median of recent samples'
            : `latest ${stats.gpuMs.toFixed(2)} ms · median of recent samples`,
      };
    case 'measuring':
      return { value: 'measuring…', tone: 'muted' };
    case 'disjoint':
      return {
        value: 'disjoint — discarded',
        tone: 'warn',
        hint: 'GPU clock changed; no sample reported',
      };
    case 'lost':
      return {
        value: 'unavailable',
        tone: 'fail',
        hint: 'context lost',
      };
    case 'unsupported':
    default:
      return {
        value: 'unavailable',
        tone: 'muted',
        hint: 'EXT_disjoint_timer_query_webgl2 not exposed',
      };
  }
}

export default function MotionLab() {
  const [tier, setTier] = useState<Tier>(2);
  const [params, setParams] = useState<LabParams>({
    ...DEFAULT_PARAMS,
    pointerRadius: TIER_CONFIG[2].pointerRadius,
  });
  const [paused, setPaused] = useState(false);
  const [resolutionScale, setResolutionScale] = useState(1);
  const [formation, setFormation] = useState<FormationId>('jin');
  const [wiping, setWiping] = useState(false);
  const [stats, setStats] = useState<LabStats | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MotionLabEngine | null>(null);
  const activeDefinition = FORMATIONS[formation];
  const formationIndex = FORMATION_ORDER.indexOf(formation) + 1;

  const effectiveTier: Tier = reducedMotion ? 0 : tier;
  const mode: 'gpu' | 'css' = effectiveTier === 0 ? 'css' : 'gpu';
  const isCssFallback =
    mode === 'css' ||
    engineError !== null ||
    stats?.context === 'lost' ||
    stats?.context === 'failed';

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    const onChange = () => setReducedMotion(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (mode !== 'gpu') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setEngineError(null);
    let engine: MotionLabEngine;

    try {
      engine = new MotionLabEngine(canvas, {
        tier: isActiveTier(tier) ? tier : 2,
        params,
        resolutionScale,
        onStats: setStats,
      });
    } catch (error) {
      setStats(null);
      setEngineError(
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    engineRef.current = engine;

    return () => {
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      engine.dispose();
      setStats(null);
    };
    // The engine owns the context for the whole GPU mode. Tier and parameter
    // changes are applied by the effects below without re-creating it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, retryKey]);

  useEffect(() => {
    if (mode !== 'gpu' || !isActiveTier(tier)) return;
    engineRef.current?.setTier(tier);
  }, [tier, mode]);

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params, mode]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused, mode]);

  useEffect(() => {
    engineRef.current?.setResolutionScale(resolutionScale);
  }, [resolutionScale, mode]);

  const selectTier = useCallback(
    (value: Tier) => {
      if (reducedMotion) return;
      setTier(value);
      if (isActiveTier(value)) {
        setParams((current) => ({
          ...current,
          pointerRadius: TIER_CONFIG[value].pointerRadius,
        }));
      }
    },
    [reducedMotion],
  );

  const togglePaused = useCallback(() => {
    setPaused((value) => !value);
  }, []);

  const resetFormation = useCallback(() => {
    engineRef.current?.reset();
  }, []);

  const resetParams = useCallback(() => {
    setParams({
      ...DEFAULT_PARAMS,
      pointerRadius: isActiveTier(tier)
        ? TIER_CONFIG[tier].pointerRadius
        : DEFAULT_PARAMS.pointerRadius,
    });
  }, [tier]);

  // Approved 380 ms wipe (simple envelope): the stage fades opaque, the
  // engine swaps the formation beneath it at midpoint, then the stage
  // fades back. No cross-blend of formations, no morph.
  const requestFormation = useCallback(
    (id: FormationId) => {
      if (reducedMotion || mode !== 'gpu') return;
      if (engineError !== null) return;
      if (stats?.context === 'lost' || stats?.context === 'failed') return;
      if (id === formation) return;
      setWiping(true);
      window.setTimeout(() => {
        const engine = engineRef.current;
        const ok = engine ? engine.setFormation(id) : false;
        if (ok) {
          setFormation(id);
        }
        // A refusal is surfaced through the panel as an engine error.
      }, 190);
      window.setTimeout(() => setWiping(false), 380);
    },
    [formation, reducedMotion, mode, engineError, stats?.context],
  );

  const loseContext = useCallback(() => {
    engineRef.current?.loseContextForTest();
  }, []);

  const restoreContext = useCallback(() => {
    engineRef.current?.restoreContextForTest();
  }, []);

  const retryEngine = useCallback(() => {
    setEngineError(null);
    setStats(null);
    setRetryKey((key) => key + 1);
  }, []);

  const testEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('test');
  }, []);

  useEffect(() => {
    if (!testEnabled) return;

    const host = window as unknown as {
      __motionLab?: MotionLabTestHooks;
    };
    host.__motionLab = {
      getStats: () => engineRef.current?.getStats() ?? null,
      getCapabilities: () =>
        engineRef.current?.getCapabilities() ?? null,
      getGpuSamples: () => engineRef.current?.getGpuSamples() ?? [],
      getFrameSamples: () =>
        engineRef.current?.getFrameSamples() ?? [],
      getParticleState: () =>
        engineRef.current?.sampleParticleState() ?? null,
      clearGpuSamples: () => {
        engineRef.current?.clearGpuSamples();
      },
      clearFrameSamples: () => {
        engineRef.current?.clearFrameSamples();
      },
      setFormation: (id: string) => {
        const engine = engineRef.current;
        if (!engine) return false;
        const ok = engine.setFormation(id);
        if (ok) {
          setFormation(id as FormationId);
        }
        return ok;
      },
      setTier: (value) => {
        setTier(value);
        if (isActiveTier(value)) {
          setParams((current) => ({
            ...current,
            pointerRadius: TIER_CONFIG[value].pointerRadius,
          }));
        }
      },
      setParams: (value) =>
        setParams((current) => ({ ...current, ...value })),
      setPaused: (value) => setPaused(value),
      setResolutionScale: (value) => setResolutionScale(value),
      reset: () => {
        if (!engineRef.current) return false;
        engineRef.current.reset();
        return true;
      },
      loseContext: () =>
        engineRef.current?.loseContextForTest() ?? false,
      restoreContext: () =>
        engineRef.current?.restoreContextForTest() ?? false,
      checkGlError: () => {
        const engine = engineRef.current;
        return engine ? engine.checkGlError() : 'no-engine';
      },
      getState: () => ({
        tier,
        formation,
        reducedMotion,
        mode,
        paused,
        resolutionScale,
        engineError,
      }),
    };

    return () => {
      delete host.__motionLab;
    };
  }, [
    testEnabled,
    tier,
    formation,
    reducedMotion,
    mode,
    paused,
    resolutionScale,
    engineError,
  ]);

  const controlsDisabled =
    mode !== 'gpu' ||
    engineError !== null ||
    stats?.context === 'lost' ||
    stats?.context === 'failed';

  const gpu = gpuStatus(stats, mode === 'css');
  const tierTarget =
    effectiveTier === 3
      ? 5
      : effectiveTier === 2
        ? 4
        : effectiveTier === 1
          ? 3
          : null;

  const stageMode = engineError
    ? 'GPU UNAVAILABLE'
    : effectiveTier === 0
      ? 'STATIC / TIER 0'
      : paused
        ? 'PAUSED'
        : stats?.context === 'lost'
          ? 'CONTEXT LOST'
          : stats?.mode === 'gpgpu'
            ? 'GPGPU · LIVE'
            : stats
              ? 'ANALYTIC · FALLBACK'
              : 'BOOTING';

  const stageTone =
    stats?.context === 'lost' ||
    stats?.context === 'failed' ||
    engineError
      ? 'fail'
      : paused
        ? 'idle'
        : effectiveTier === 0
          ? 'idle'
          : stats?.mode === 'gpgpu'
            ? 'live'
            : 'idle';

  const stageHint = engineError
    ? 'The GPU field did not start. The static atmospheric fallback is shown; details are in the panel.'
    : reducedMotion
      ? 'Reduced motion is active. The static atmosphere is shown and no WebGL context is created.'
      : effectiveTier === 0
        ? 'Tier 0 is a static CSS atmosphere. Select Tier 1–3 to start a GPU field.'
        : stats?.context === 'lost'
          ? 'The WebGL context was lost. Restore it from Diagnostics to rebuild the simulation.'
          : stats?.mode === 'gpgpu'
            ? 'Move the pointer through the column. The field yields, then springs back toward the formation.'
            : stats
              ? 'Formation-lite preview: pointer displacement is direct and there is no GPU spring simulation.'
              : 'Preparing the GPU field.';

  const count =
    stats?.particleCount ??
    (isActiveTier(effectiveTier)
      ? TIER_CONFIG[effectiveTier].particles
      : 0);
  const simLabel =
    stats?.simSize !== null && stats?.simSize !== undefined
      ? `${stats.simSize}²`
      : effectiveTier === 0
        ? 'CSS'
        : '—';

  const webgl2Tone: Tone = stats
    ? 'pass'
    : engineError
      ? 'fail'
      : 'muted';
  const floatTone: Tone = !stats
    ? 'muted'
    : stats.mode === 'gpgpu'
      ? 'pass'
      : stats.capabilities.colorBufferFloat
        ? 'warn'
        : 'fail';
  const floatValue = !stats
    ? 'not probed'
    : stats.mode === 'gpgpu'
      ? 'supported · verified'
      : stats.capabilities.colorBufferFloat
        ? stats.fallbackReason
          ? 'supported · fallback active'
          : 'supported · not active'
        : 'unavailable';
  const timerTone: Tone = !stats
    ? 'muted'
    : stats.capabilities.timerQuery
      ? 'pass'
      : 'warn';

  const notices: ReactNode[] = [];

  if (engineError) {
    notices.push(
      <Notice
        key="engine-error"
        tone="error"
        title="GPU initialization failed"
        action={
          <button
            type="button"
            className="lab-btn"
            onClick={retryEngine}
          >
            Retry GPU init
          </button>
        }
      >
        <p>{engineError}</p>
      </Notice>,
    );
  }

  if (stats?.runtimeError) {
    notices.push(
      <Notice key="runtime-error" tone="error" title="Runtime stopped">
        <p>{stats.runtimeError}</p>
      </Notice>,
    );
  }

  if (stats?.fallbackReason) {
    notices.push(
      <Notice key="fallback" tone="warn" title="Analytic fallback">
        <p>{stats.fallbackReason}</p>
        <p>
          The formation still previews at the selected particle count, but
          pointer motion is a direct displacement rather than a spring
          simulation.
        </p>
      </Notice>,
    );
  }

  if (reducedMotion) {
    notices.push(
      <Notice key="reduced" tone="info" title="Reduced motion">
        <p>
          <code>prefers-reduced-motion: reduce</code> locks the lab to Tier 0.
          No canvas context is created.
        </p>
      </Notice>,
    );
  } else if (effectiveTier === 0) {
    notices.push(
      <Notice key="tier0" tone="info" title="Tier 0 — static">
        <p>
          The GPU simulation is stopped and all simulation resources are
          released. The stage uses the CSS atmosphere only.
        </p>
      </Notice>,
    );
  }

  if (stats?.context === 'lost') {
    notices.push(
      <Notice
        key="context-lost"
        tone="warn"
        title="WebGL context lost"
        action={
          <button
            type="button"
            className="lab-btn"
            onClick={restoreContext}
          >
            Restore context
          </button>
        }
      >
        <p>
          All GPU objects are invalid. Restoring rebuilds the programs,
          allocates fresh targets and reseeds the formation.
        </p>
      </Notice>,
    );
  }

  if (stats?.context === 'failed') {
    notices.push(
      <Notice
        key="context-failed"
        tone="error"
        title="Context restore failed"
        action={
          <button
            type="button"
            className="lab-btn"
            onClick={retryEngine}
          >
            Rebuild engine
          </button>
        }
      >
        <p>
          The failure is reported above. The static fallback remains usable.
        </p>
      </Notice>,
    );
  }

  if (paused) {
    notices.push(
      <Notice key="paused" tone="info" title="Paused">
        <p>
          Simulation time is frozen. Rendering and instrumentation continue.
        </p>
      </Notice>,
    );
  }

  return (
    <div className="lab-shell">
      <header className="lab-top">
        <div className="lab-brand">
          <span className="lab-brand__mark" aria-hidden="true" />
          <span>SLEDGE</span>
          <span className="lab-brand__divider">/</span>
          <span className="lab-brand__sub">Motion Lab</span>
        </div>
        <div className="lab-top__meta">
          <span
            className="lab-live-dot"
            data-active={mode === 'gpu' && !engineError}
            aria-hidden="true"
          />
          <span>
            {mode === 'gpu' && !engineError
              ? 'GPU active'
              : 'CSS fallback'}
          </span>
          <span className="lab-top__sep">·</span>
          <span>R2.5 / Stage 0</span>
        </div>
      </header>

      <main className="lab-main">
        <div className="lab-left">
          <section
            className="lab-stage-wrap"
            aria-label={`${activeDefinition.character} — ${activeDefinition.name} motion lab`}
          >
            <div className="lab-stage">
              {mode === 'gpu' ? (
                <canvas
                  ref={canvasRef}
                  className="lab-canvas"
                  aria-hidden="true"
                  data-dimmed={isCssFallback ? 'true' : 'false'}
                />
              ) : null}
              {wiping ? (
                <div className="lab-wipe" aria-hidden="true" />
              ) : null}

              {isCssFallback ? <CssFallback /> : null}

              <div className="lab-stage__grid" aria-hidden="true" />

              <div className="lab-stage__top">
                <span className="lab-stage__index">
                  {String(formationIndex).padStart(2, '0')} /{' '}
                  {activeDefinition.name}
                </span>
                <span
                  className="lab-stage__mode"
                  data-tone={stageTone}
                >
                  <span
                    className="lab-stage__dot"
                    aria-hidden="true"
                  />
                  {stageMode}
                </span>
              </div>

              <div className="lab-stage__bottom">
                <p className="lab-stage__hint">{stageHint}</p>
                <span className="lab-stage__count">
                  {count.toLocaleString('en-US')} particles / {simLabel}
                </span>
              </div>

              {stats?.context === 'lost' ? (
                <div className="lab-stage__message">
                  <p className="lab-kicker">Signal lost</p>
                  <h2>Context interrupted</h2>
                  <p>
                    The simulation stopped safely. Restore from
                    Diagnostics, or wait for the browser to restore the
                    context.
                  </p>
                  <button
                    type="button"
                    className="lab-btn"
                    onClick={restoreContext}
                  >
                    Restore context
                  </button>
                </div>
              ) : null}

              {engineError ? (
                <div className="lab-stage__message">
                  <p className="lab-kicker">Fallback active</p>
                  <h2>GPU unavailable</h2>
                  <p>{engineError}</p>
                  <button
                    type="button"
                    className="lab-btn"
                    onClick={retryEngine}
                  >
                    Retry GPU init
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="lab-controls" aria-label="Laboratory controls">
            <div className="lab-controls__head">
              <div>
                <p className="lab-kicker">Controls</p>
                <h2>Shape the field</h2>
              </div>
              <div className="lab-actions">
                <button
                  type="button"
                  className="lab-btn"
                  onClick={togglePaused}
                  disabled={controlsDisabled}
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="lab-btn"
                  onClick={resetFormation}
                  disabled={controlsDisabled}
                >
                  Reset formation
                </button>
              </div>
            </div>

            <div
              className="lab-tier-row"
              role="group"
              aria-label="Quality tier"
            >
              {TIER_OPTIONS.map((option) => (
                <button
                  key={option.tier}
                  type="button"
                  className="lab-tier"
                  aria-pressed={effectiveTier === option.tier}
                  disabled={reducedMotion}
                  onClick={() => selectTier(option.tier)}
                >
                  <span className="lab-tier__id">T{option.tier}</span>
                  <span className="lab-tier__name">{option.name}</span>
                  <span className="lab-tier__detail">
                    {option.detail}
                  </span>
                </button>
              ))}
            </div>

            <div
              className="lab-formation-row"
              role="group"
              aria-label="Formation"
            >
              {FORMATION_ORDER.map((id) => {
                const def = FORMATIONS[id];
                const active = formation === id;
                const disabled = !def.implemented || reducedMotion;
                return (
                  <button
                    key={id}
                    type="button"
                    className="lab-tier"
                    aria-pressed={active}
                    disabled={disabled}
                    title={
                      def.implemented
                        ? `${def.character} — ${def.name}`
                        : `${def.character} — planned, not implemented in this build`
                    }
                    onClick={() => requestFormation(id)}
                  >
                    <span className="lab-tier__id">
                      {id.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="lab-tier__name">{def.name}</span>
                    <span className="lab-tier__detail">
                      {def.implemented
                        ? active
                          ? 'active'
                          : 'available'
                        : 'planned'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="lab-render-row">
              <span className="lab-render-row__label">Render scale</span>
              <div
                className="lab-scale-row"
                role="group"
                aria-label="Render resolution scale"
              >
                {[0.25, 0.5, 0.75, 1].map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    className="lab-scale"
                    aria-pressed={resolutionScale === scale}
                    disabled={reducedMotion}
                    onClick={() => setResolutionScale(scale)}
                  >
                    {scale.toFixed(2)}×
                  </button>
                ))}
              </div>
              <span className="lab-render-row__note">
                canvas backing scale; simulation stays 64²
              </span>
            </div>

            <div className="lab-params">
              <div className="lab-params__toolbar">
                <p>
                  Interaction parameters are experimental; ranges are
                  clamped to the R2.2 brief.
                </p>
                <button
                  type="button"
                  className="lab-btn"
                  onClick={resetParams}
                >
                  Defaults
                </button>
              </div>
              <div className="lab-param-grid">
                {PARAM_CONTROLS.map((control) => {
                  const [min, max] = PARAM_LIMITS[control.key];
                  const value = params[control.key];
                  const id = `lab-param-${control.key}`;
                  return (
                    <div className="lab-param" key={control.key}>
                      <div className="lab-param__head">
                        <label htmlFor={id}>{control.label}</label>
                        <output htmlFor={id}>
                          {value.toFixed(control.digits)}
                        </output>
                      </div>
                      <input
                        id={id}
                        type="range"
                        min={min}
                        max={max}
                        step={control.step}
                        value={value}
                        onChange={(event) =>
                          setParams((current) => ({
                            ...current,
                            [control.key]: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="lab-side">
          <section className="lab-intro">
            <p className="lab-kicker">
              {activeDefinition.id === 'jin' ? 'Approved' : 'Planned'} /{' '}
              {activeDefinition.name}
            </p>
            <h1 className="lab-title">
              Ember <span>Pillar</span>
            </h1>
            <p className="lab-lede">
              A GPU-simulated column of ember filaments held by a spring
              field. Move through the column to displace it; release and
              the formation settles back into shape.
            </p>
            <div className="lab-tags">
              <span>GPGPU state</span>
              <span>Pointer wake</span>
              <span>No dependencies</span>
            </div>
          </section>

          {notices}

          <section className="lab-panel" aria-label="Instrumentation">
            <div className="lab-block-head">
              <h2>Instrumentation</h2>
              <span>live panel</span>
            </div>

            <dl className="lab-metrics">
              <MetricRow
                label="FPS"
                value={formatNumber(stats?.fps ?? null, 1)}
                tone={stats?.fps ? 'pass' : 'muted'}
              />
              <MetricRow
                label="frame median (CPU)"
                value={formatNumber(
                  stats?.frameMedianMs ?? null,
                  2,
                  ' ms',
                )}
                hint="rAF pacing, not GPU time"
              />
              <MetricRow
                label="frame p95 (CPU)"
                value={formatNumber(
                  stats?.frameP95Ms ?? null,
                  2,
                  ' ms',
                )}
              />
              <MetricRow
                label="GPU frame (timer)"
                value={gpu.value}
                tone={gpu.tone}
                hint={gpu.hint}
              />
              <MetricRow
                label="tier"
                value={`Tier ${stats?.tier ?? effectiveTier}`}
              />
              <MetricRow
                label="formation"
                value={stats?.formationName ?? activeDefinition.name}
                tone={stats?.formation ? 'pass' : 'muted'}
                hint={
                  stats ? `R2.5 · ${stats.formation}` : 'initializing'
                }
              />
              <MetricRow
                label="particles"
                value={
                  mode === 'css'
                    ? '0 · static CSS'
                    : stats
                      ? `${stats.particleCount.toLocaleString('en-US')} · ${stats.filaments} filaments`
                      : '—'
                }
              />
              <MetricRow
                label="simulation"
                value={
                  mode === 'css'
                    ? 'none (CSS)'
                    : stats?.simSize
                      ? `${stats.simSize} × ${stats.simSize} RGBA16F`
                      : stats
                        ? '— (analytic)'
                        : '—'
                }
              />
              <MetricRow
                label="mode"
                value={
                  mode === 'css'
                    ? 'CSS · static'
                    : !stats
                      ? '—'
                      : stats.mode === 'gpgpu'
                        ? 'GPGPU · 2 passes'
                        : stats.tier === 1
                          ? 'analytic · formation-lite'
                          : 'analytic · fallback'
                }
                tone={
                  mode === 'css'
                    ? 'muted'
                    : stats?.mode === 'gpgpu'
                      ? 'pass'
                      : stats
                        ? 'warn'
                        : 'muted'
                }
              />
              <MetricRow
                label="draw calls / frame"
                value={mode === 'css' ? '0' : stats ? String(stats.drawsPerFrame) : '—'}
              />
              <MetricRow
                label="render passes / frame"
                value={mode === 'css' ? '0' : stats ? String(stats.passesPerFrame) : '—'}
              />
              <MetricRow
                label="GPGPU allocation"
                value={
                  stats
                    ? formatBytes(stats.gpgpuBytes)
                    : formatBytes(0)
                }
                hint={
                  stats?.gpgpuTextures
                    ? `${stats.gpgpuTextures} × 64² RGBA16F textures`
                    : 'texture storage only'
                }
              />
              <MetricRow
                label="backing"
                value={
                  stats
                    ? `${stats.backingWidth} × ${stats.backingHeight} @ ${stats.dpr.toFixed(2)}×`
                    : '—'
                }
              />
              <MetricRow
                label="viewport"
                value={
                  stats
                    ? `${Math.round(stats.cssWidth)} × ${Math.round(stats.cssHeight)} CSS`
                    : '—'
                }
              />
              <MetricRow
                label="render scale"
                value={
                  stats
                    ? `${Math.round(stats.renderScale * 100)}%`
                    : '—'
                }
                hint="canvas only; simulation stays 64²"
              />
              <MetricRow
                label="context"
                value={
                  engineError
                    ? 'failed'
                    : stats
                      ? stats.context
                      : mode === 'css'
                        ? 'not created (Tier 0)'
                        : 'initializing'
                }
                tone={
                  engineError || stats?.context === 'failed'
                    ? 'fail'
                    : stats?.context === 'lost'
                      ? 'warn'
                      : stats
                        ? 'pass'
                        : 'muted'
                }
              />
            </dl>

            <p className="lab-caption">
              Two clocks: frame median/p95 describe CPU-side requestAnimationFrame
              pacing; GPU frame comes only from
              {' '}
              <code>EXT_disjoint_timer_query_webgl2</code>
              {' '}and is discarded when the timer reports a disjoint event.
              The GPU query covers every draw in the frame — atmosphere,
              simulation and sprite passes — not the sprite pass alone.
              {tierTarget !== null
                ? ` Tier ${effectiveTier} target ≤ ${tierTarget.toFixed(2)} ms (provisional).`
                : ' Tier 0 performs no GPU work.'}
            </p>

            <div className="lab-block-head lab-block-head--sub">
              <h2>Support</h2>
              <span>this context</span>
            </div>
            <dl className="lab-metrics">
              <MetricRow
                label="WebGL2"
                value={
                  stats
                    ? 'available'
                    : engineError
                      ? 'unavailable'
                      : 'not probed'
                }
                tone={webgl2Tone}
              />
              <MetricRow
                label="float render targets"
                value={floatValue}
                tone={floatTone}
                hint={
                  stats?.capabilities.maxTextureSize
                    ? `MAX_TEXTURE_SIZE ${stats.capabilities.maxTextureSize}`
                    : undefined
                }
              />
              <MetricRow
                label="GPU timer"
                value={
                  !stats
                    ? 'not probed'
                    : stats.capabilities.timerQuery
                      ? 'available'
                      : 'unavailable'
                }
                tone={timerTone}
              />
              <MetricRow
                label="renderer"
                value={
                  stats?.capabilities.renderer ?? 'not probed'
                }
                tone={stats?.capabilities.renderer ? 'muted' : 'muted'}
                stack
              />
            </dl>

            <details className="lab-diag">
              <summary>Diagnostics</summary>
              <div className="lab-diag__body">
                <p>
                  Context loss is a failure path, not a performance test.
                  Loss discards every GPU object; restore recompiles the
                  programs, reallocates the targets and reseeds the
                  formation at the current simulation time.
                </p>
                <div className="lab-actions">
                  <button
                    type="button"
                    className="lab-btn"
                    onClick={loseContext}
                    disabled={
                      mode !== 'gpu' ||
                      engineError !== null ||
                      stats?.context !== 'active'
                    }
                  >
                    Lose context
                  </button>
                  <button
                    type="button"
                    className="lab-btn"
                    onClick={restoreContext}
                    disabled={stats?.context !== 'lost'}
                  >
                    Restore context
                  </button>
                </div>
                <p className="lab-hintline">
                  GPU allocation covers texture storage only. Driver
                  placement, alignment and command-buffer overhead are not
                  measurable from JavaScript and are not included.
                </p>
              </div>
            </details>
          </section>
        </aside>
      </main>

      <footer className="lab-footer">
        <span>
          Isolated experiment · no production renderer, navigation,
          artwork or content is loaded
        </span>
        <span>Stage A · Jin only · {GPGPU_BYTES.toLocaleString('en-US')} B GPGPU state</span>
      </footer>
    </div>
  );
}

function CssFallback() {
  return (
    <div className="lab-fallback" aria-hidden="true">
      <div className="lab-fallback__haze" />
      <div className="lab-fallback__column" />
      <div className="lab-fallback__core" />
      <div className="lab-fallback__embers" />
    </div>
  );
}
