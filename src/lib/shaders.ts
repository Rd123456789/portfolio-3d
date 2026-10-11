import * as THREE from "three";

/**
 * Shader materials shared by the canvas assets. Each is a single additive quad
 * (or two) — no render targets, no extra passes — so the visual payoff is
 * essentially free compared with the geometry they decorate.
 */

/** Soft radial disc, used for rotor blur, ground glow and corona haze. */
const DISC_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * uStreaks above 0 paints that many rotating blades inside the disc so a rotor
 * reads as spinning; 0 leaves a plain soft blob.
 */
const DISC_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uStreaks;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;

    // Radial falloff: opaque centre dissolving to the rim
    float core = smoothstep(1.0, 0.15, d);

    // Rotating blade streaks
    float blades = 0.0;
    if (uStreaks > 0.5) {
      float ang = atan(p.y, p.x);
      blades = pow(abs(cos(ang * uStreaks * 0.5 + uTime * 3.2)), 12.0);
      blades *= smoothstep(1.0, 0.35, d) * 0.8;
    }

    float alpha = (core + blades) * uIntensity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, 1.0) * alpha;
  }
`;

export interface DiscMaterialOptions {
  color?: THREE.ColorRepresentation;
  intensity?: number;
  /** Number of rotating blade streaks; 0 for a plain soft disc. */
  streaks?: number;
}

export function createDiscMaterial({
  color = "#FE6E00",
  intensity = 0.3,
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

/** Feed elapsed time into a disc material so blade streaks spin. */
export function tickDiscMaterial(
  material: THREE.ShaderMaterial,
  elapsed: number
): void {
  if (material.uniforms?.uTime) {
    material.uniforms.uTime.value = elapsed;
  }
}

/**
 * Globe core: a lit sphere with a warm terminator and a signal-orange rim.
 * The scene's directional light never touches this asset, so the terminator is
 * evaluated in the shader against a fixed view-space sun vector.
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
  uniform vec3 uRim;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 sunDir = normalize(uSun);
    // Soft terminator: day side lifts toward a warm charcoal, night side stays deep
    float day = smoothstep(-0.25, 0.85, dot(n, sunDir));
    vec3 col = mix(uBase, uLit, day);

    // Warm rim all the way around, stronger where the surface turns away from us
    float fresnel = pow(1.0 - abs(dot(n, normalize(vView))), 3.0);
    col += uRim * fresnel * 0.28;

    // Radar sweep: a narrow bright meridian travelling around the sphere
    float lon = atan(vLocal.x, vLocal.z) + uTime * 0.42;
    float sweep = pow(max(0.0, cos(lon)), 90.0);
    col += uRim * sweep * 0.9;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createGlobeCoreMaterial(sun?: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color("#060606") },
      uLit: { value: new THREE.Color("#43280F") },
      uRim: { value: new THREE.Color("#FE6E00") },
      uSun: { value: sun ?? new THREE.Vector3(0.55, 0.4, 0.72).normalize() },
      uTime: { value: 0 },
    },
    vertexShader: CORE_VERTEX,
    fragmentShader: CORE_FRAGMENT,
  });
}

/**
 * Continental dot matrix with a day/night terminator. Compared with the built-in
 * points material this also rounds each dot and keeps it soft-edged.
 */
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
    // Local-space normal on a unit sphere is just the position
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
    // Round the dot with a soft edge so the matrix reads as printed dots, not pixels
    float alpha = smoothstep(1.0, 0.45, d) * uOpacity;
    // Add a touch of bloom on the sunlit side so land pops
    vec3 col = vColor + vec3(0.10, 0.05, 0.015) * vSun;
    gl_FragColor = vec4(col, 1.0) * alpha;
  }
`;


/**
 * Terrain dot matrix. Vertex positions and colours are baked on the CPU (radial
 * relief plus world-space hillshade), so this material only sizes the points and
 * passes colour through — no per-fragment relief work at all.
 */
const TERRAIN_POINTS_VERTEX = `
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uScale;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (uScale / max(0.001, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const TERRAIN_POINTS_FRAGMENT = `
  uniform float uOpacity;
  varying vec3 vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float alpha = smoothstep(1.0, 0.5, d) * uOpacity;
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
      uSun: { value: sun ?? new THREE.Vector3(0.55, 0.4, 0.72).normalize() },
    },
    vertexShader: DOTS_VERTEX,
    fragmentShader: DOTS_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Keep a dot matrix's point-size scale in sync with the live drawing buffer. */
export function syncDotMatrixScale(
  material: THREE.ShaderMaterial,
  height: number,
  dpr: number
): void {
  if (material.uniforms?.uScale) {
    material.uniforms.uScale.value = height * dpr * 0.5;
  }
}

/**
 * Night-side urban glow. Each point carries a per-vertex size (driven by real
 * metropolitan population) and is masked to the dark hemisphere, so city lights
 * only appear where the sun is down, exactly like a real earth-at-night pass.
 */
const NIGHTLIGHT_VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uScale;
  uniform vec3 uSun;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    // Only the night hemisphere gets lights
    vec3 n = normalize(position);
    float day = dot(n, normalize(uSun));
    float nightMask = 1.0 - smoothstep(-0.12, 0.18, day);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (uScale / max(0.001, -mvPosition.z)) * nightMask;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const NIGHTLIGHT_FRAGMENT = `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    // Dense core falling softly to the edges: read as emitted light, not a decal
    float core = smoothstep(1.0, 0.1, d);
    float alpha = core * 0.75;
    gl_FragColor = vec4(vColor, 1.0) * alpha;
  }
`;

export interface NightLightMaterialOptions {
  sun?: THREE.Vector3;
}

export function createNightLightMaterial({
  sun,
}: NightLightMaterialOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 500 },
      uSun: { value: sun ?? new THREE.Vector3(0.55, 0.4, 0.72).normalize() },
    },
    vertexShader: NIGHTLIGHT_VERTEX,
    fragmentShader: NIGHTLIGHT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Landmark pins: a bright pulsing dot with a faint halo ring, in one draw call
 * for the whole city set.
 */
const PIN_VERTEX = `
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (uScale / max(0.001, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PIN_FRAGMENT = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(0.55, 0.0, d);
    float ring = smoothstep(0.09, 0.0, abs(d - 0.86));
    float pulse = 0.85 + 0.35 * sin(uTime * 2.4);

    float a = (core * pulse + ring * 0.4) * uOpacity;
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

/**
 * Fresnel atmosphere shell. The rim term drives alpha so the silhouette burns
 * brighter than the disc — a physically believable glow for the cost of one
 * additive sphere, versus a transmission pass that re-rendered the whole scene.
 */
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
  uniform float uPower;
  uniform float uIntensity;
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(fresnel, uPower);

    vec3 n = normalize(vNormal);
    vec3 sunDir = normalize(uSun);
    vec3 viewDir = normalize(vView);

    // Rayleigh phase function: Mie-like forward scatter peaks toward the sun,
    // which is why the limb near the sub-solar point glows strongest.
    float cosTheta = dot(-viewDir, sunDir);
    float rayleigh = 0.75 * (1.0 + cosTheta * cosTheta);

    // Optical depth grows toward the limb; this thickens the glow there
    float limb = pow(fresnel, 0.6);

    // Day side is warm-forward-scattered, night side keeps a thin residual
    float daylight = smoothstep(-0.35, 0.45, dot(n, sunDir));

    float strength = rim * limb * rayleigh * (0.12 + 0.95 * daylight) * uIntensity;
    gl_FragColor = vec4(uColor, 1.0) * strength;
  }
`;

export function createAtmosphereMaterial(sun?: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color("#FE6E00") },
      uPower: { value: 3.1 },
      uIntensity: { value: 1.5 },
      uSun: { value: sun ?? new THREE.Vector3(0.55, 0.4, 0.72).normalize() },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}
