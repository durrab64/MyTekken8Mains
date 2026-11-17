import type { GpuTimingStatus } from '../types';

interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export interface FrameSnapshot {
  fps: number | null;
  medianMs: number | null;
  p95Ms: number | null;
}

export interface GpuSnapshot {
  lastMs: number | null;
  medianMs: number | null;
  status: GpuTimingStatus;
}

export class FrameMeter {
  private samples: number[] = [];

  push(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > 500) {
      return;
    }
    this.samples.push(deltaMs);
    if (this.samples.length > 90) {
      this.samples.shift();
    }
  }

  snapshot(): FrameSnapshot {
    if (this.samples.length < 2) {
      return { fps: null, medianMs: null, p95Ms: null };
    }

    const sum = this.samples.reduce((total, value) => total + value, 0);
    const sorted = [...this.samples].sort((a, b) => a - b);
    const percentile = (value: number): number => {
      const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.floor((sorted.length - 1) * value)),
      );
      return sorted[index];
    };

    return {
      fps: 1000 / (sum / this.samples.length),
      medianMs: percentile(0.5),
      p95Ms: percentile(0.95),
    };
  }

  getSamples(): number[] {
    return [...this.samples];
  }

  reset(): void {
    this.samples = [];
  }
}

/**
 * Thin wrapper around EXT_disjoint_timer_query_webgl2. Only one query is in
 * flight at a time. A disjoint result invalidates the whole pending sample;
 * it is never reported as a GPU time.
 */
export class GpuTimer {
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExtension | null;
  private activeQuery: WebGLQuery | null = null;
  private waitingQuery: WebGLQuery | null = null;
  private waitingSince = 0;
  private samples: number[] = [];
  private status: GpuTimingStatus;
  private contextLost = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.ext = gl.getExtension(
      'EXT_disjoint_timer_query_webgl2',
    ) as TimerExtension | null;
    this.status = this.ext ? 'measuring' : 'unsupported';
  }

  get supported(): boolean {
    return this.ext !== null;
  }

  begin(): void {
    if (
      !this.ext ||
      this.contextLost ||
      this.activeQuery ||
      this.waitingQuery
    ) {
      return;
    }

    const query = this.gl.createQuery();
    if (!query) return;

    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.activeQuery = query;
  }

  end(): void {
    if (!this.ext || this.contextLost || !this.activeQuery) return;

    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.waitingQuery = this.activeQuery;
    this.activeQuery = null;
    this.waitingSince = performance.now();
  }

  /** Returns a new valid GPU sample, or null. Disjoint samples are dropped. */
  poll(now: number): number | null {
    if (!this.ext || this.contextLost || !this.waitingQuery) {
      return null;
    }

    if (now - this.waitingSince > 2500) {
      this.gl.deleteQuery(this.waitingQuery);
      this.waitingQuery = null;
      this.status = 'measuring';
      return null;
    }

    const available = Boolean(
      this.gl.getQueryParameter(
        this.waitingQuery,
        this.gl.QUERY_RESULT_AVAILABLE,
      ),
    );
    if (!available) return null;

    const query = this.waitingQuery;
    this.waitingQuery = null;
    const disjoint = Boolean(
      this.gl.getParameter(this.ext.GPU_DISJOINT_EXT),
    );

    if (disjoint) {
      this.gl.deleteQuery(query);
      this.samples = [];
      this.status = 'disjoint';
      return null;
    }

    const nanoseconds = Number(
      this.gl.getQueryParameter(query, this.gl.QUERY_RESULT),
    );
    this.gl.deleteQuery(query);

    if (!Number.isFinite(nanoseconds) || nanoseconds <= 0) {
      this.status = 'measuring';
      return null;
    }

    const milliseconds = nanoseconds / 1e6;
    this.samples.push(milliseconds);
    if (this.samples.length > 15) {
      this.samples.shift();
    }
    this.status = 'ok';
    return milliseconds;
  }

  snapshot(): GpuSnapshot {
    if (!this.ext) {
      return { lastMs: null, medianMs: null, status: 'unsupported' };
    }

    if (this.status === 'lost') {
      return { lastMs: null, medianMs: null, status: 'lost' };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? null
        : sorted[Math.floor((sorted.length - 1) / 2)];
    const last =
      this.samples.length === 0
        ? null
        : this.samples[this.samples.length - 1];
    const status: GpuTimingStatus =
      this.samples.length > 0 ? 'ok' : this.status;

    return { lastMs: last, medianMs: median, status };
  }

  resetSamples(): void {
    this.samples = [];
    this.status = this.ext ? 'measuring' : 'unsupported';
  }

  markLost(): void {
    this.contextLost = true;
    this.activeQuery = null;
    this.waitingQuery = null;
    this.samples = [];
    this.status = 'lost';
  }

  dispose(): void {
    if (!this.contextLost && this.ext) {
      if (this.activeQuery) {
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.gl.deleteQuery(this.activeQuery);
        this.activeQuery = null;
      }
      if (this.waitingQuery) {
        this.gl.deleteQuery(this.waitingQuery);
        this.waitingQuery = null;
      }
    }
    this.samples = [];
  }
}
