import * as THREE from "three";

/**
 * Shader materials shared by the main-page 3D engineering assets.
 */

const DISC_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISC_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uStreaks;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(1.0, 0.12, d);
    float ring = smoothstep(0.08, 0.0, abs(d - 0.88)) * 0.65;

    float blades = 0.0;
    if (uStreaks > 0.5) {
      float ang = atan(p.y, p.x);
      blades = pow(abs(cos(ang * uStreaks * 0.5 + uTime * 3.8)), 10.0);
      blades *= smoothstep(1.0, 0.2, d) * 0.9;
    }

    float alpha = (core * 0.65 + ring + blades) * uIntensity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, 1.0) * alpha;
  }
`;

export interface DiscMaterialOptions {
  color?: THREE.ColorRepresentation;
  intensity?: number;
  streaks?: number;
}

export function createDiscMaterial({
  color = "#FE6E00",
  intensity = 0.35,
  streaks = 0,
}: DiscMaterialOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uStreaks: { value: streaks },
      uTime: { value: 0 },
    },
    vertexShader: DISC_VERTEX,
    fragmentShader: DISC_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function tickDiscMaterial(
  material: THREE.ShaderMaterial,
  elapsed: number
): void {
  if (material.uniforms?.uTime) {
    material.uniforms.uTime.value = elapsed;
  }
}

/**
 * Planetary GIS Core Sphere:
 * Deep obsidian-slate ocean floor with subtle bathymetric contour bands,
 * dual-tone Fresnel rim (Signal Orange + Telemetry Cyan), and an active
 * meridian telemetry sweep.
 */
const CORE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CORE_FRAGMENT = `
  uniform vec3 uBase;
  uniform vec3 uLit;
  uniform vec3 uRimWarm;
  uniform vec3 uRimCool;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    vec3 sunDir = normalize(uSun);

    float day = smoothstep(-0.25, 0.75, dot(n, sunDir));
    vec3 col = mix(uBase, uLit, day);

    // Subtle latitude telemetry banding across the ocean sphere
    float latBands = 0.5 + 0.5 * sin(vLocal.y * 48.0);
    col += vec3(0.015, 0.028, 0.045) * latBands * (0.4 + 0.6 * day);

    // Specular ocean glint on the sunlit hemisphere
    vec3 halfVec = normalize(sunDir + v);
    float spec = pow(max(0.0, dot(n, halfVec)), 28.0);
    col += vec3(0.10, 0.18, 0.28) * spec * day;

    // Dual-tone Fresnel rim: warm orange on day limb, cyan on orbital limb
    float fresnel = pow(1.0 - abs(dot(n, v)), 2.8);
    vec3 rimCol = mix(uRimCool, uRimWarm, smoothstep(-0.2, 0.5, n.x + n.y * 0.4));
    col += rimCol * fresnel * 0.52;

    // Travelling meridian radar sweep
    float lon = atan(vLocal.x, vLocal.z) + uTime * 0.48;
    float sweep = pow(max(0.0, cos(lon)), 72.0);
    col += uRimWarm * sweep * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createGlobeCoreMaterial(
  sun?: THREE.Vector3
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color("#070B11") },
      uLit: { value: new THREE.Color("#111D2B") },
      uRimWarm: { value: new THREE.Color("#FE6E00") },
      uRimCool: { value: new THREE.Color("#38BDF8") },
      uSun: { value: sun ?? new THREE.Vector3(0.45, 0.38, 0.81).normalize() },
      uTime: { value: 0 },
    },
    vertexShader: CORE_VERTEX,
    fragmentShader: CORE_FRAGMENT,
  });
}

const TERRAIN_POINTS_VERTEX = `
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uScale;
  varying vec3 vColor;
  varying float vGrazing;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mvPosition.xyz);
    // Keep front-facing hemisphere crisp and fade back-facing/limb points cleanly
    vGrazing = smoothstep(0.04, 0.26, dot(nView, viewDir));
    gl_PointSize = uSize * (uScale / max(0.001, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TERRAIN_POINTS_FRAGMENT = `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vGrazing;

  void main() {
    if (vGrazing < 0.01) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float alpha = smoothstep(1.0, 0.35, d) * uOpacity * vGrazing;
    gl_FragColor = vec4(vColor, 1.0) * alpha;
  }
`;

export interface TerrainDotMatrixOptions {
  size: number;
  opacity?: number;
}

export function createTerrainDotMatrixMaterial({
  size,
  opacity = 1,
}: TerrainDotMatrixOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uScale: { value: 500 },
      uOpacity: { value: opacity },
    },
    vertexShader: TERRAIN_POINTS_VERTEX,
    fragmentShader: TERRAIN_POINTS_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

const DOTS_VERTEX = `
  attribute vec3 color;
  uniform float uSize;
  uniform float uScale;
  uniform vec3 uSun;
  uniform float uNightDim;
  varying vec3 vColor;
  varying float vSun;

  void main() {
    vColor = color;
    vec3 n = normalize(position);
    float day = smoothstep(-0.18, 0.6, dot(n, uSun));
    vSun = day;
    vColor *= mix(uNightDim, 1.0, day);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (uScale / max(0.001, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DOTS_FRAGMENT = `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vSun;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float alpha = smoothstep(1.0, 0.35, d) * uOpacity;
    vec3 col = vColor + vec3(0.10, 0.05, 0.015) * vSun;
    gl_FragColor = vec4(col, 1.0) * alpha;
  }
`;

export interface DotMatrixMaterialOptions {
  size: number;
  opacity?: number;
  nightDim?: number;
  sun?: THREE.Vector3;
}

export function createDotMatrixMaterial({
  size,
  opacity = 0.96,
  nightDim = 0.16,
  sun,
}: DotMatrixMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uScale: { value: 500 },
      uOpacity: { value: opacity },
      uNightDim: { value: nightDim },
      uSun: { value: sun ?? new THREE.Vector3(0.45, 0.38, 0.81).normalize() },
    },
    vertexShader: DOTS_VERTEX,
    fragmentShader: DOTS_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export function syncDotMatrixScale(
  material: THREE.ShaderMaterial,
  height: number,
  dpr: number
): void {
  if (material.uniforms?.uScale) {
    material.uniforms.uScale.value = height * dpr * 0.5;
  }
}

const NIGHTLIGHT_VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uScale;
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    vec3 viewDir = normalize(-mvPosition.xyz);
    vVisible = smoothstep(0.05, 0.25, dot(nView, viewDir));
    gl_PointSize = aSize * (uScale / max(0.001, -mvPosition.z)) * vVisible;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NIGHTLIGHT_FRAGMENT = `
  varying vec3 vColor;
  varying float vVisible;
  void main() {
    if (vVisible < 0.01) discard;
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(1.0, 0.08, d);
    float alpha = core * 0.85 * vVisible;
    gl_FragColor = vec4(vColor, 1.0) * alpha;
  }
`;

export interface NightLightMaterialOptions {
  sun?: THREE.Vector3;
}

export function createNightLightMaterial(
  _opts: NightLightMaterialOptions = {}
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 500 },
    },
    vertexShader: NIGHTLIGHT_VERTEX,
    fragmentShader: NIGHTLIGHT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

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
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(0.5, 0.0, d);
    float ring = smoothstep(0.11, 0.0, abs(d - 0.82));
    float pulse = 0.88 + 0.25 * sin(uTime * 2.8);

    float a = (core * pulse + ring * 0.55) * uOpacity * vVisible;
    gl_FragColor = vec4(vColor, 1.0) * a;
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
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  uniform float uPower;
  uniform float uIntensity;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float fresnel = 1.0 - abs(dot(n, v));
    float rim = pow(fresnel, uPower);

    float dayMix = smoothstep(-0.35, 0.55, dot(n, normalize(uSun)));
    vec3 col = mix(uSecondaryColor, uColor, dayMix);

    float strength = rim * (0.35 + 0.75 * dayMix) * uIntensity;
    gl_FragColor = vec4(col, 1.0) * strength;
  }
`;

export function createAtmosphereMaterial(
  sun?: THREE.Vector3
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color("#FE6E00") },
      uSecondaryColor: { value: new THREE.Color("#38BDF8") },
      uPower: { value: 3.2 },
      uIntensity: { value: 0.78 },
      uSun: { value: sun ?? new THREE.Vector3(0.45, 0.38, 0.81).normalize() },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/**
 * Front-hemisphere occluded line shader for sphere-wrapped lines (graticule,
 * coastlines). Fades lines cleanly before the limb and discards back-facing
 * segments so the back of the globe never bleeds through.
 */
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
