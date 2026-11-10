import * as THREE from "three";
import { getLandMask } from "./geo";

/**
 * Shader materials shared by the main-page 3D engineering assets.
 */

/** A single clock uniform several materials can share and tick once a frame. */
export type TimeUniform = { value: number };

/*
 * Materials are long-lived GPU objects that are meant to be mutated every
 * frame. Components create them once and drive them through these setters
 * rather than reaching into `uniforms` from render code.
 */
export function advanceClock(clock: TimeUniform, elapsed: number): void {
  clock.value = elapsed;
}

export function setUniform(
  material: THREE.ShaderMaterial,
  name: string,
  value: number
): void {
  const uniform = material.uniforms[name];
  if (uniform) uniform.value = value;
}

export function setUniformColor(
  material: THREE.ShaderMaterial,
  name: string,
  color: THREE.ColorRepresentation
): void {
  const uniform = material.uniforms[name];
  if (uniform) (uniform.value as THREE.Color).set(color);
}

const UV_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* -------------------------------------------------------------------------
   Rotor disc: the smear a fast propeller leaves, not a glowing plate.
   The disc spins with the blades, so the two lobes sit on the blade axis.
------------------------------------------------------------------------- */

const ROTOR_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0) discard;

    float lobe = pow(abs(cos(atan(p.y, p.x))), 2.5);
    float body = smoothstep(0.07, 0.2, r) * smoothstep(1.0, 0.9, r);
    float haze = 0.085 + 0.2 * lobe;

    // The painted blade tips blur into a continuous coloured hoop
    float tip = smoothstep(0.03, 0.0, abs(r - 0.955));

    vec3 col = mix(vec3(0.56, 0.62, 0.70), uColor, tip);
    float alpha = (haze * body + tip * (0.22 + 0.34 * lobe)) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createRotorDiscMaterial(
  color: THREE.ColorRepresentation = "#FE6E00",
  opacity = 1
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: UV_VERTEX,
    fragmentShader: ROTOR_FRAGMENT,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/* -------------------------------------------------------------------------
   Globe core: dark ocean with the continents as a solid, slightly lifted
   silhouette under the dot matrix. Lit from a fixed view-space sun.
------------------------------------------------------------------------- */

const CORE_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CORE_FRAGMENT = `
  uniform sampler2D uLand;
  uniform vec3 uOceanNight;
  uniform vec3 uOceanDay;
  uniform vec3 uLandNight;
  uniform vec3 uLandDay;
  uniform vec3 uRimWarm;
  uniform vec3 uRimCool;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    vec3 sunDir = normalize(uSun);

    float ndl = dot(n, sunDir);
    float day = smoothstep(-0.35, 0.85, ndl);
    float facing = max(0.0, dot(n, v));
    float land = smoothstep(0.34, 0.66, texture2D(uLand, vUv).r);

    vec3 ocean = mix(uOceanNight, uOceanDay, day);
    vec3 ground = mix(uLandNight, uLandDay, day);
    vec3 col = mix(ocean, ground, land);

    // Limb darkening gives the sphere volume without a painted gradient
    col *= 0.62 + 0.38 * facing;

    // Soft specular glint, open water only
    vec3 halfVec = normalize(sunDir + v);
    float spec = pow(max(0.0, dot(n, halfVec)), 36.0);
    col += vec3(0.10, 0.17, 0.26) * spec * (1.0 - land) * 0.55;

    // Thin limb light: warm where the sun grazes, cool on the shadow side
    float fresnel = pow(1.0 - facing, 5.0);
    vec3 rimCol = mix(uRimCool, uRimWarm, smoothstep(-0.15, 0.6, ndl));
    col += rimCol * fresnel * 0.09;

    // Travelling meridian survey sweep
    float lon = atan(vLocal.x, vLocal.z) + uTime * 0.42;
    float sweep = pow(max(0.0, cos(lon)), 90.0);
    col += mix(uRimCool, uRimWarm, 0.7) * sweep * (0.10 + 0.16 * land);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createLandMaskTexture(): THREE.DataTexture {
  const { data, width, height } = getLandMask();
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RedFormat,
    THREE.UnsignedByteType
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export function createGlobeCoreMaterial(
  sun: THREE.Vector3,
  landMask: THREE.Texture
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLand: { value: landMask },
      uOceanNight: { value: new THREE.Color("#05080E") },
      uOceanDay: { value: new THREE.Color("#0C1622") },
      uLandNight: { value: new THREE.Color("#0F151D") },
      uLandDay: { value: new THREE.Color("#1D2937") },
      uRimWarm: { value: new THREE.Color("#FE6E00") },
      uRimCool: { value: new THREE.Color("#38BDF8") },
      uSun: { value: sun },
      uTime: { value: 0 },
    },
    vertexShader: CORE_VERTEX,
    fragmentShader: CORE_FRAGMENT,
  });
}

/* -------------------------------------------------------------------------
   Continental dot matrix
------------------------------------------------------------------------- */

const TERRAIN_POINTS_VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uSize;
  uniform float uScale;
  uniform vec3 uSun;
  varying vec3 vColor;
  varying float vGrazing;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mvPosition.xyz);

    // Fade toward the limb, where dots would otherwise pile up edge-on
    vGrazing = smoothstep(0.03, 0.3, dot(nView, viewDir));

    float day = smoothstep(-0.3, 0.7, dot(nView, normalize(uSun)));
    vColor = aColor * mix(0.34, 1.0, day);

    gl_PointSize = uSize * aSize * (uScale / max(0.001, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TERRAIN_POINTS_FRAGMENT = `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vGrazing;

  void main() {
    if (vGrazing < 0.01) discard;
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float alpha = smoothstep(1.0, 0.55, d) * uOpacity * vGrazing;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export interface TerrainDotMatrixOptions {
  size: number;
  opacity?: number;
  sun: THREE.Vector3;
}

export function createTerrainDotMatrixMaterial({
  size,
  opacity = 1,
  sun,
}: TerrainDotMatrixOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uScale: { value: 500 },
      uOpacity: { value: opacity },
      uSun: { value: sun },
    },
    vertexShader: TERRAIN_POINTS_VERTEX,
    fragmentShader: TERRAIN_POINTS_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Keeps point sprites a constant world size across viewport and DPR changes. */
export function syncDotMatrixScale(
  material: THREE.ShaderMaterial,
  height: number,
  dpr: number
): void {
  setUniform(material, "uScale", height * dpr * 0.5);
}

/* -------------------------------------------------------------------------
   City gazetteer pins
------------------------------------------------------------------------- */

const PIN_VERTEX = `
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uScale;
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mvPosition.xyz);
    vVisible = smoothstep(0.05, 0.22, dot(nView, viewDir));
    gl_PointSize = uSize * (uScale / max(0.001, -mvPosition.z)) * vVisible;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PIN_FRAGMENT = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    if (vVisible < 0.01) discard;
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(0.42, 0.12, d);
    float ring = smoothstep(0.1, 0.0, abs(d - 0.8));
    float pulse = 0.85 + 0.15 * sin(uTime * 2.4);

    float a = (core * pulse + ring * 0.5) * uOpacity * vVisible;
    gl_FragColor = vec4(vColor, a);
  }
`;

export function createLandmarkMaterial(size: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uScale: { value: 500 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: PIN_VERTEX,
    fragmentShader: PIN_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/* -------------------------------------------------------------------------
   Atmosphere: a back-face shell that is brightest where it meets the planet
   and falls away to nothing at its own silhouette, so it reads as a halo
   rather than a hard outline.
------------------------------------------------------------------------- */

const ATMOSPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = `
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uReach;
  uniform float uPower;
  uniform float uIntensity;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);

    float depth = abs(dot(n, v));
    float glow = pow(smoothstep(0.0, uReach, depth), uPower);

    float dayMix = smoothstep(-0.35, 0.75, dot(n, normalize(uSun)));
    vec3 col = mix(uCool, uWarm, dayMix);

    gl_FragColor = vec4(col, glow * (0.55 + 0.45 * dayMix) * uIntensity);
  }
`;

/**
 * @param planetRadius radius of the opaque core the halo wraps
 * @param shellRadius radius of the sphere this material is applied to
 */
export function createAtmosphereMaterial(
  sun: THREE.Vector3,
  planetRadius: number,
  shellRadius: number
): THREE.ShaderMaterial {
  const reach = Math.sqrt(1 - (planetRadius / shellRadius) ** 2);
  return new THREE.ShaderMaterial({
    uniforms: {
      uWarm: { value: new THREE.Color("#FF7A1A") },
      uCool: { value: new THREE.Color("#38BDF8") },
      uReach: { value: reach },
      uPower: { value: 3.2 },
      uIntensity: { value: 0.44 },
      uSun: { value: sun },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/* -------------------------------------------------------------------------
   Sphere-wrapped lines (graticule, coastlines): fade before the limb and drop
   back-facing segments so the far side never bleeds through.
------------------------------------------------------------------------- */

const GRID_LINE_VERTEX = `
  varying float vGrazing;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mvPosition.xyz);
    vGrazing = smoothstep(0.02, 0.22, dot(nView, viewDir));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const GRID_LINE_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vGrazing;
  void main() {
    float a = uOpacity * vGrazing;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export interface GlobeGridLineOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
}

export function createGlobeGridLineMaterial({
  color = "#38BDF8",
  opacity = 0.34,
}: GlobeGridLineOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: GRID_LINE_VERTEX,
    fragmentShader: GRID_LINE_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
}

/* -------------------------------------------------------------------------
   Flow line: a tube (uv.x along its length) carrying comet pulses. Used for
   the globe's telemetry arcs and the substation's energised conductors, in
   place of sphere meshes chased along curves on the CPU.
------------------------------------------------------------------------- */

const FLOW_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPulses;
  uniform float uOffset;
  uniform float uBase;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float u = vUv.x;
    float ends =
      smoothstep(0.0, max(1e-4, uFadeStart), u) *
      smoothstep(1.0, 1.0 - max(1e-4, uFadeEnd), u);

    float phase = fract(u * uPulses - uTime * uSpeed + uOffset);
    float comet = pow(phase, 7.0);
    float head = smoothstep(0.9, 1.0, phase);

    vec3 col = uColor * (uBase + comet * 1.5) + vec3(1.0) * head * 0.85;
    float alpha = clamp(uBase + comet + head, 0.0, 1.0) * ends * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface FlowLineOptions {
  color: THREE.ColorRepresentation;
  time: TimeUniform;
  /** Pulse travel in lengths of the line per second. */
  speed?: number;
  /** How many pulses ride the line at once. */
  pulses?: number;
  offset?: number;
  /** Brightness of the line between pulses. */
  base?: number;
  /** Fraction of the line that fades in at its start / out at its end. */
  fadeStart?: number;
  fadeEnd?: number;
  opacity?: number;
}

export function createFlowLineMaterial({
  color,
  time,
  speed = 0.4,
  pulses = 1,
  offset = 0,
  base = 0.42,
  fadeStart = 0.02,
  fadeEnd = 0.02,
  opacity = 1,
}: FlowLineOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: time,
      uSpeed: { value: speed },
      uPulses: { value: pulses },
      uOffset: { value: offset },
      uBase: { value: base },
      uFadeStart: { value: fadeStart },
      uFadeEnd: { value: fadeEnd },
      uOpacity: { value: opacity },
    },
    vertexShader: UV_VERTEX,
    fragmentShader: FLOW_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/* -------------------------------------------------------------------------
   Survey terrain: a shaded digital-twin surface with elevation contours, a
   survey grid, and the LiDAR sweep painted across the relief itself.
------------------------------------------------------------------------- */

const TERRAIN_DECK_VERTEX = `
  varying vec3 vLocal;
  varying vec3 vNormalLocal;
  void main() {
    vLocal = position;
    vNormalLocal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TERRAIN_DECK_FRAGMENT = `
  uniform vec3 uTheme;
  uniform float uScanZ;
  uniform float uScanDir;
  uniform float uMaxHeight;
  uniform float uContour;
  uniform float uCell;
  varying vec3 vLocal;
  varying vec3 vNormalLocal;

  float lineMask(float value, float width) {
    float d = abs(fract(value - 0.5) - 0.5) / max(1e-5, fwidth(value));
    return 1.0 - smoothstep(width - 0.5, width + 0.5, d);
  }

  void main() {
    float h = clamp(vLocal.y / uMaxHeight, 0.0, 1.0);

    // Hypsometric tint: cold valleys, slate slopes, theme-warm summits
    vec3 col = mix(vec3(0.010, 0.016, 0.028), vec3(0.026, 0.046, 0.072), smoothstep(0.0, 0.55, h));
    col = mix(col, uTheme * 0.16 + vec3(0.02), smoothstep(0.45, 1.0, h) * 0.8);

    // Relief shading from the real surface normal
    vec3 n = normalize(vNormalLocal);
    float lit = max(0.0, dot(n, normalize(vec3(-0.45, 0.8, 0.4))));
    col *= 0.45 + 0.85 * lit;

    // Elevation contours, with every fourth drawn as an index contour
    float level = vLocal.y / uContour;
    float contour = lineMask(level, 0.55);
    float index = lineMask(level / 4.0, 0.85);
    col += vec3(0.022, 0.095, 0.15) * contour * (0.5 + 0.5 * h);
    col += mix(vec3(0.04, 0.2, 0.32), uTheme * 0.4, h) * index * 0.6;

    // Survey grid draped over the relief
    vec2 cell = vLocal.xz / uCell;
    float grid = max(lineMask(cell.x, 0.5), lineMask(cell.y, 0.5));
    col += vec3(0.10, 0.13, 0.17) * grid * 0.5;

    // LiDAR sweep: a hot return line and the freshly captured swath behind it
    float dz = (vLocal.z - uScanZ) * uScanDir;
    float beam = exp(-abs(dz) * 60.0);
    float wake = step(dz, 0.0) * exp(dz * 4.5);
    col += uTheme * (beam * 0.8 + wake * (0.02 + 0.16 * contour + 0.22 * index + 0.04 * grid));
    col += vec3(1.0) * beam * beam * 0.3;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface TerrainDeckOptions {
  theme: THREE.ColorRepresentation;
  maxHeight: number;
  /** Height between contour lines, in the terrain's own units. */
  contour?: number;
  /** Survey grid cell size. */
  cell?: number;
}

export function createTerrainDeckMaterial({
  theme,
  maxHeight,
  contour = 0.026,
  cell = 0.295,
}: TerrainDeckOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTheme: { value: new THREE.Color(theme) },
      uScanZ: { value: 0 },
      uScanDir: { value: 1 },
      uMaxHeight: { value: maxHeight },
      uContour: { value: contour },
      uCell: { value: cell },
    },
    vertexShader: TERRAIN_DECK_VERTEX,
    fragmentShader: TERRAIN_DECK_FRAGMENT,
  });
}

/* -------------------------------------------------------------------------
   LiDAR curtain: a fan whose apex sits at uv (0.5, 0) and whose base spans
   uv.x 0..1 at uv.y 1. Individual pulses read as rays inside the sheet.
------------------------------------------------------------------------- */

const CURTAIN_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uRays;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float range = vUv.y;
    float across = (vUv.x - 0.5) / max(range, 1e-3) + 0.5;

    float sheet = mix(0.26, 0.05, range);
    float rays = pow(abs(sin(across * 3.14159 * uRays)), 40.0) * 0.34;
    float rim = smoothstep(0.035, 0.0, min(across, 1.0 - across)) * 0.45;
    float groundHit = smoothstep(0.94, 1.0, range) * 0.5;

    float alpha = (sheet + rays + rim + groundHit) * smoothstep(0.0, 0.07, range) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createScanCurtainMaterial(
  color: THREE.ColorRepresentation,
  rays = 13,
  opacity = 0.5
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRays: { value: rays },
      uOpacity: { value: opacity },
    },
    vertexShader: UV_VERTEX,
    fragmentShader: CURTAIN_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
