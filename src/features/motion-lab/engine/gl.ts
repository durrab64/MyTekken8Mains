export interface GlGeometry {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(`${label}: could not create a shader object`);
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    const stage = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`${label}: ${stage} shader failed to compile\n${log}`);
  }

  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  label: string,
): WebGLProgram {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    vertexSource,
    label,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentSource,
    label,
  );
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`${label}: could not create a program object`);
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`${label}: program failed to link\n${log}`);
  }

  gl.detachShader(program, vertexShader);
  gl.detachShader(program, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

export function deleteProgram(
  gl: WebGL2RenderingContext,
  program: WebGLProgram | null,
): void {
  if (program) {
    gl.deleteProgram(program);
  }
}

export function createGeometry(
  gl: WebGL2RenderingContext,
  vertices: Float32Array,
): GlGeometry {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();

  if (!vao || !buffer) {
    if (vao) gl.deleteVertexArray(vao);
    if (buffer) gl.deleteBuffer(buffer);
    throw new Error('Could not create geometry buffers');
  }

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return { vao, buffer };
}

export function deleteGeometry(
  gl: WebGL2RenderingContext,
  geometry: GlGeometry | null,
): void {
  if (!geometry) return;
  gl.deleteBuffer(geometry.buffer);
  gl.deleteVertexArray(geometry.vao);
}

export function createDataTexture(
  gl: WebGL2RenderingContext,
  size: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Could not create a simulation texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA16F,
    size,
    size,
    0,
    gl.RGBA,
    gl.HALF_FLOAT,
    null,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

export function createFramebuffer(
  gl: WebGL2RenderingContext,
  attachments: WebGLTexture[],
  label: string,
): WebGLFramebuffer {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error(`${label}: could not create a framebuffer`);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  attachments.forEach((texture, index) => {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0 + index,
      gl.TEXTURE_2D,
      texture,
      0,
    );
  });
  gl.drawBuffers(attachments.map((_, index) => gl.COLOR_ATTACHMENT0 + index));

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer);
    throw new Error(
      `${label}: framebuffer incomplete (0x${status.toString(16)})`,
    );
  }

  return framebuffer;
}

export function uploadTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  size: number,
  data: Float32Array,
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    size,
    size,
    gl.RGBA,
    gl.FLOAT,
    data,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
}

export function drainGlErrors(gl: WebGL2RenderingContext): void {
  for (let index = 0; index < 16; index += 1) {
    if (gl.getError() === gl.NO_ERROR) return;
  }
}

export function readGlError(gl: WebGL2RenderingContext): string | null {
  const error = gl.getError();
  return error === gl.NO_ERROR ? null : `0x${error.toString(16)}`;
}

export function assertNoGlError(
  gl: WebGL2RenderingContext,
  label: string,
): void {
  const error = readGlError(gl);
  if (error) {
    throw new Error(`${label}: WebGL error ${error}`);
  }
}

export interface DebugRendererInfo {
  renderer: string | null;
  vendor: string | null;
}

export function readDebugRendererInfo(
  gl: WebGL2RenderingContext,
): DebugRendererInfo {
  const extension = gl.getExtension('WEBGL_debug_renderer_info') as {
    UNMASKED_RENDERER_WEBGL: number;
    UNMASKED_VENDOR_WEBGL: number;
  } | null;

  if (!extension) {
    return { renderer: null, vendor: null };
  }

  const renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
  const vendor = gl.getParameter(extension.UNMASKED_VENDOR_WEBGL);

  return {
    renderer: typeof renderer === 'string' ? renderer : null,
    vendor: typeof vendor === 'string' ? vendor : null,
  };
}
