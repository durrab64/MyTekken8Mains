import type { EnvironmentConfig } from './environments';
import { particleVertexSource, particleFragmentSource } from './shaders';

export interface Particles {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject | null;
  u: Record<string, WebGLUniformLocation | null>;
  count: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('particle shader creation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`particle shader compile failed: ${log}`);
  }
  return shader;
}

export function createParticles(gl: WebGL2RenderingContext): Particles {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, particleVertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, particleFragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`particle program link failed: ${log}`);
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['uTime', 'uSwirl', 'uSize', 'uSeed', 'uPointer', 'uAspect', 'uOrigin', 'uDir', 'uTintA', 'uTintB', 'uSharp']) {
    u[n] = gl.getUniformLocation(program, n);
  }
  gl.useProgram(program);
  gl.uniform2f(u.uPointer, 2, 2);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindVertexArray(null);
  return { program, vao, u, count: 0 };
}

export function applyParticleEnv(
  gl: WebGL2RenderingContext,
  particles: Particles,
  env: EnvironmentConfig,
): void {
  gl.useProgram(particles.program);
  gl.uniform2fv(particles.u.uOrigin, env.origin);
  gl.uniform2fv(particles.u.uDir, env.dir);
  gl.uniform1f(particles.u.uSwirl, env.swirl);
  gl.uniform1f(particles.u.uSize, env.size);
  gl.uniform1f(particles.u.uSharp, env.sharp);
  gl.uniform3fv(particles.u.uTintA, env.tintA);
  gl.uniform3fv(particles.u.uTintB, env.tintB);
  gl.uniform1f(particles.u.uSeed, Math.random() * 1000);
}

export function drawParticles(
  gl: WebGL2RenderingContext,
  particles: Particles,
  timeSeconds: number,
  count: number,
): void {
  gl.useProgram(particles.program);
  gl.bindVertexArray(particles.vao);
  gl.uniform1f(particles.u.uTime, timeSeconds);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

export function destroyParticles(gl: WebGL2RenderingContext, particles: Particles | null): void {
  if (!particles) return;
  gl.deleteProgram(particles.program);
  gl.deleteVertexArray(particles.vao);
}
