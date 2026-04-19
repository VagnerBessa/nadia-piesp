import React, { useRef, useEffect } from 'react';

const simplexNoise = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x   + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}`;

const declarePI = `
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
`;

const proceduralHash11 = `
float hash11(float p) {
  p = fract(p * .1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}`;

const proceduralHash21 = `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;
uniform float u_pxSize;
uniform float u_pulse;
uniform float u_awakening_progress;

out vec4 fragColor;

${simplexNoise}
${declarePI}
${proceduralHash11}
${proceduralHash21}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));
  return noise;
}

// Matriz de Rotação 2D
mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
  0,  8,  2, 10,
 12,  4, 14,  6,
  3, 11,  1,  9,
 15,  7, 13,  5
);

const int bayer8x8[64] = int[64](
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(mod(uv, float(size)));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}

void main() {
  float t = .5 * u_time;
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv -= .5;
  
  float pxSize = u_pxSize;
  vec2 pxSizeUv = gl_FragCoord.xy;
  pxSizeUv -= .5 * u_resolution;
  pxSizeUv /= pxSize;
  vec2 pixelizedUv = floor(pxSizeUv) * pxSize / u_resolution.xy;
  
  vec2 shape_uv = pixelizedUv;
  vec2 dithering_uv = pxSizeUv;
  vec2 ditheringNoise_uv = uv * u_resolution;

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise
    shape_uv *= .001;
    shape = 0.5 + 0.5 * getSimplexNoise(shape_uv, t);
    shape = smoothstep(0.3, 0.9, shape);

  } else if (u_shape < 2.5) {
    // Warp
    shape_uv *= .003;
    for (float i = 1.0; i < 6.0; i++) {
      shape_uv.x += 0.6 / i * cos(i * 2.5 * shape_uv.y + t);
      shape_uv.y += 0.6 / i * cos(i * 1.5 * shape_uv.x + t);
    }
    shape = .15 / abs(sin(t - shape_uv.y - shape_uv.x));
    shape = smoothstep(0.02, 1., shape);

  } else if (u_shape < 3.5) {
    // Dots
    shape_uv *= .05;
    float stripeIdx = floor(2. * shape_uv.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shape_uv.x) * cos(shape_uv.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);

  } else if (u_shape < 4.5) {
    // Sine wave
    shape_uv *= 4.;
    float wave = cos(.5 * shape_uv.x - 2. * t) * sin(1.5 * shape_uv.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shape_uv.y + wave);

  } else if (u_shape < 5.5) {
    // Ripple
    float dist = length(shape_uv);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Swirl
    float l = length(shape_uv);
    float angle = 6. * atan(shape_uv.y, shape_uv.x) + 4. * t;
    float twist = 1.2;
    float offset = pow(l, -twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);

  } else {
    // Sphere (Nadia Mode)
    // Scale shape_uv for positioning
    shape_uv *= 2.105;
    
    // Calculate 2D disc distance (the "body" of the sphere)
    float d = 1. - pow(length(shape_uv), 2.);

    if (d >= 0.0) {
      // 3D & Rotational Effect
      
      // 1. Create a texture coordinate that rotates over time
      // This simulates the planet spinning.
      // We use t * 0.5 for speed. 
      vec2 texture_uv = rotate2d(t * 0.5) * shape_uv;
      
      // 2. Base sphere rendering (Lighting)
      vec3 pos = vec3(texture_uv, sqrt(d));
      vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
      
      // Calculate lighting based on rotated surface normal
      float lighting = 0.5 + 0.5 * dot(lightPos, pos);
      
      // Pulse effect (glow)
      float glow = pow(max(0.0, 1.0 - length(shape_uv)), 1.8) * u_pulse * 0.4;
      
      float final_lit_shape = clamp(lighting + glow, 0.0, 1.0);

      // Awakening Animation Logic (Wipe effect)
      if (u_awakening_progress >= 0.0 && u_awakening_progress < 1.0) {
        float p = u_awakening_progress;
        float eased_progress = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;

        float wipe_coord = mix(-1.1, 1.1, eased_progress);
        float wipe_softness = 0.15;
        
        float revealed_alpha = smoothstep(wipe_coord - wipe_softness, wipe_coord + wipe_softness, shape_uv.y);
        
        float leading_edge_glow = 0.5 * (1.0 - eased_progress);
        float leading_edge = (smoothstep(wipe_coord - 0.02, wipe_coord, shape_uv.y) - smoothstep(wipe_coord, wipe_coord + 0.02, shape_uv.y)) * leading_edge_glow;

        shape = final_lit_shape * revealed_alpha + leading_edge;

      } else {
        // Standard State
        shape = final_lit_shape;
      }
    } else {
      shape = 0.0; // Outside the circle
    }
  }

  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoise_uv), shape);
    } break;
    case 2:
      dithering = getBayerValue(dithering_uv, 2);
      break;
    case 3:
      dithering = getBayerValue(dithering_uv, 4);
      break;
    default:
      dithering = getBayerValue(dithering_uv, 8);
      break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}`;

const vertexShaderSource = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}
`;

export type DitheringShape = 'sphere' | 'noise' | 'warp' | 'dots' | 'wave' | 'ripple' | 'swirl';

interface DitheringShaderProps {
  width: number;
  height: number;
  shape: DitheringShape | string;
  speed: number;
  colorFront: string;
  colorBack: string;
  pxSize: number;
  type?: string;
  pulseLevel?: number;
  awakeningProgress?: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : [0, 0, 0];
};

export const DitheringShader: React.FC<DitheringShaderProps> = ({
  width,
  height,
  shape,
  speed,
  colorFront,
  colorBack,
  pxSize,
  type = 'random',
  pulseLevel = 0,
  awakeningProgress = -1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  
  // Usar refs para valores que atualizam a 60fps para evitar recompilação de Shader no WebGL
  const pulseRef = useRef(pulseLevel);
  const speedRef = useRef(speed);
  const awakeningRef = useRef(awakeningProgress);

  // Sincroniza props com refs sem engatilhar recompilação WebGL
  useEffect(() => { pulseRef.current = pulseLevel; }, [pulseLevel]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { awakeningRef.current = awakeningProgress; }, [awakeningProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const createProgram = (gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    };

    const vertShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertShader || !fragShader) return;

    const program = createProgram(gl, vertShader, fragShader);
    if (!program) return;

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const colorBackLocation = gl.getUniformLocation(program, 'u_colorBack');
    const colorFrontLocation = gl.getUniformLocation(program, 'u_colorFront');
    const shapeLocation = gl.getUniformLocation(program, 'u_shape');
    const typeLocation = gl.getUniformLocation(program, 'u_type');
    const pxSizeLocation = gl.getUniformLocation(program, 'u_pxSize');
    const pulseLocation = gl.getUniformLocation(program, 'u_pulse');
    const awakeningLocation = gl.getUniformLocation(program, 'u_awakening_progress');

    const render = (time: number) => {
      timeRef.current += 0.01 * speedRef.current; // Lendo do Ref
      
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform1f(timeLocation, timeRef.current);
      gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

      const rgbBack = hexToRgb(colorBack);
      gl.uniform4f(colorBackLocation, rgbBack[0], rgbBack[1], rgbBack[2], 1);

      const rgbFront = hexToRgb(colorFront);
      gl.uniform4f(colorFrontLocation, rgbFront[0], rgbFront[1], rgbFront[2], 1);

      let shapeVal = 7.0; // sphere default
      if (shape === 'noise') shapeVal = 1.0;
      else if (shape === 'warp') shapeVal = 2.0;
      else if (shape === 'dots') shapeVal = 3.0;
      else if (shape === 'wave') shapeVal = 4.0;
      else if (shape === 'ripple') shapeVal = 5.0;
      else if (shape === 'swirl') shapeVal = 6.0;

      gl.uniform1f(shapeLocation, shapeVal);

      let typeVal = 0.0; // random/noise
      if (type === 'random') typeVal = 1.0;
      else if (type === 'bayer2') typeVal = 2.0;
      else if (type === 'bayer4') typeVal = 3.0;
      else typeVal = 4.0; 

      gl.uniform1f(typeLocation, typeVal);
      gl.uniform1f(pxSizeLocation, pxSize);
      
      // Lendo do Ref (60fps seguro)
      gl.uniform1f(pulseLocation, pulseRef.current);
      gl.uniform1f(awakeningLocation, awakeningRef.current);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
      gl.deleteProgram(program);
    };
  }, [width, height, shape, colorFront, colorBack, pxSize, type]);

  return <canvas ref={canvasRef} width={width} height={height} className="block" />;
};