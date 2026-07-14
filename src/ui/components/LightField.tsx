// Atmospheric backdrop for the title: a living light box. A warm lamp
// drifts slowly behind the film, the caisson breathes, fine grain sits on
// top. Deliberately low-contrast — it sets a mood behind the composition,
// it never competes with it. `variant` selects the treatment.

import { useEffect, useRef } from "react";

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uVariant;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float dots(vec2 q, float ang){
  float s = sin(ang), c = cos(ang);
  vec2 r = mat2(c, -s, s, c) * q;
  vec2 cell = fract(r) - 0.5;
  return smoothstep(0.34, 0.24, length(cell));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x, 1.0 - uv.y);
  float aspect = uRes.x / uRes.y;
  vec2 asp = vec2(aspect, 1.0);

  // a warm lamp drifting slowly behind the film (biased left, like the comp)
  vec2 lamp = vec2(0.40 + 0.05 * sin(uTime * 0.13), 0.46 + 0.04 * cos(uTime * 0.11));
  float d = length((p - lamp) * asp);
  float glow = pow(1.0 - smoothstep(0.0, 0.95, d), 1.7);

  vec3 room = vec3(0.076, 0.064, 0.053);
  vec3 warm = vec3(0.150, 0.127, 0.101);
  vec3 col = mix(room, warm, glow);

  // the caisson breathes — a barely-there overall lift
  col += warm * 0.018 * (0.5 + 0.5 * sin(uTime * 0.4));

  // variant 1: a faint halftone revealed only inside the glow
  if (uVariant > 0.5 && uVariant < 1.5) {
    vec2 q = p * 150.0; q.x *= aspect;
    float reveal = smoothstep(0.35, 0.95, glow);
    col += (vec3(0.20,0.80,0.88) * dots(q, 0.26) + vec3(1.0,0.28,0.60) * dots(q, -0.26)) * reveal * 0.03;
  }

  // variant 2: a cool cyan counter-lamp on the right — subtle duotone depth
  if (uVariant > 1.5) {
    vec2 cool = vec2(0.82 + 0.04 * sin(uTime * 0.09 + 2.0), 0.5);
    float dc = length((p - cool) * asp);
    float cg = pow(1.0 - smoothstep(0.0, 0.8, dc), 2.0);
    col += vec3(0.10, 0.34, 0.40) * cg * 0.16;
  }

  // fine grain, then vignette back into the room
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.020;
  float vig = 1.0 - smoothstep(0.5, 1.28, length((uv - 0.5) * asp));
  col *= mix(0.82, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function LightField({
  variant = 0,
  reduced,
}: {
  variant?: number;
  reduced: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    gl.uniform1f(gl.getUniformLocation(prog, "uVariant"), variant);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const draw = (t: number) => {
      gl.uniform1f(uTime, t * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(draw);
    };
    if (reduced) {
      gl.uniform1f(uTime, 6);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [variant, reduced]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
