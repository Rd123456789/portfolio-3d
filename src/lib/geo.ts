import * as THREE from "three";

/**
 * Geospatial geometry builders for the Planetary GIS Command Globe.
 * Uses true polygon rings for continents and India, plus clean vertex-pair
 * line segments so graticules and coastlines never draw stray connecting chords.
 */

export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** High-precision polygon of India (Kutch -> Peninsular coast -> NE -> Himalayas -> Rajasthan). */
export const INDIA_OUTLINE: [number, number][] = [
  [23.8, 68.4],
  [22.9, 69.1],
  [22.4, 69.0],
  [20.9, 70.4],
  [21.6, 72.2],
  [20.3, 72.8],
  [18.9, 72.8],
  [16.9, 73.3],
  [14.8, 74.1],
  [12.9, 74.8],
  [10.0, 76.2],
  [8.08, 77.55],
  [9.2, 79.1],
  [10.3, 79.8],
  [13.1, 80.3],
  [15.9, 80.8],
  [17.7, 83.3],
  [19.8, 85.8],
  [21.6, 87.5],
  [21.9, 89.1],
  [24.0, 88.8],
  [26.2, 89.8],
  [26.0, 91.8],
  [27.8, 95.8],
  [28.3, 97.1],
  [29.1, 94.6],
  [27.9, 91.6],
  [27.4, 88.8],
  [26.5, 84.5],
  [28.6, 80.2],
  [30.9, 79.0],
  [32.8, 79.2],
  [34.8, 77.8],
  [35.5, 76.0],
  [34.2, 74.0],
  [32.4, 74.8],
  [30.1, 73.9],
  [27.8, 70.6],
  [25.5, 70.3],
  [24.3, 68.8],
];

const SRI_LANKA_RING: [number, number][] = [
  [9.7, 80.0],
  [8.5, 81.2],
  [6.8, 81.8],
  [5.9, 80.5],
  [6.9, 79.8],
  [8.4, 79.8],
];

/** Continental polygon rings for accurate world silhouettes. */
const WORLD_CONTINENT_RINGS: [number, number][][] = [
  // Africa
  [
    [35.8, -5.8],
    [37.0, 10.2],
    [32.5, 15.2],
    [31.5, 25.2],
    [31.2, 32.3],
    [27.8, 34.0],
    [20.0, 37.3],
    [12.5, 43.4],
    [11.8, 51.3],
    [4.5, 48.0],
    [-1.5, 41.5],
    [-10.5, 40.5],
    [-18.0, 36.8],
    [-26.0, 32.8],
    [-34.2, 25.5],
    [-34.8, 19.8],
    [-28.6, 16.5],
    [-17.2, 11.8],
    [-6.0, 12.2],
    [4.0, 9.4],
    [4.5, 2.0],
    [4.6, -7.6],
    [10.5, -14.6],
    [14.7, -17.5],
    [21.0, -17.0],
    [28.0, -13.0],
    [33.5, -7.8],
  ],
  // Madagascar
  [
    [-12.2, 49.3],
    [-16.0, 49.8],
    [-25.0, 47.0],
    [-25.4, 44.8],
    [-19.8, 44.2],
    [-15.0, 46.3],
  ],
  // Eurasia (Europe + Middle East + Asia)
  [
    [36.2, -9.0],
    [43.3, -8.8],
    [43.4, -1.8],
    [48.4, -4.6],
    [51.0, 1.8],
    [53.8, 8.8],
    [57.5, 10.2],
    [55.0, 14.0],
    [54.6, 19.6],
    [60.0, 29.8],
    [66.0, 24.5],
    [70.8, 28.0],
    [68.8, 41.0],
    [69.5, 60.0],
    [72.5, 80.0],
    [73.5, 105.0],
    [70.8, 135.0],
    [66.0, 170.0],
    [60.0, 162.0],
    [53.0, 141.0],
    [43.0, 132.0],
    [38.5, 128.5],
    [34.6, 126.5],
    [39.8, 124.2],
    [38.8, 118.0],
    [35.0, 120.5],
    [31.0, 121.8],
    [25.0, 119.5],
    [22.2, 114.2],
    [20.2, 106.8],
    [13.5, 109.2],
    [8.6, 104.8],
    [13.2, 100.8],
    [7.2, 100.4],
    [1.4, 103.9],
    [5.4, 100.2],
    [15.8, 97.6],
    [21.8, 91.8],
    [22.0, 88.5],
    [20.0, 86.2],
    [15.5, 80.3],
    [8.2, 77.5],
    [18.8, 72.8],
    [23.5, 68.4],
    [25.2, 62.0],
    [26.8, 56.4],
    [29.8, 48.6],
    [24.2, 54.5],
    [22.5, 59.8],
    [17.0, 54.2],
    [12.8, 45.0],
    [18.0, 41.2],
    [28.0, 34.8],
    [31.5, 34.4],
    [36.5, 36.0],
    [36.8, 28.0],
    [40.8, 26.5],
    [38.0, 23.8],
    [40.5, 19.4],
    [44.5, 12.4],
    [40.2, 18.2],
    [38.2, 15.6],
    [43.8, 10.2],
    [43.2, 5.4],
    [40.6, 0.5],
    [36.1, -5.4],
  ],
  // Scandinavia
  [
    [55.6, 12.8],
    [58.8, 11.0],
    [60.4, 5.2],
    [63.5, 9.5],
    [68.5, 15.5],
    [71.0, 25.8],
    [65.8, 24.0],
    [60.2, 18.8],
  ],
  // Great Britain
  [
    [50.1, -5.2],
    [51.4, 1.4],
    [53.6, 0.1],
    [56.0, -2.8],
    [58.6, -3.2],
    [57.2, -5.8],
    [54.8, -4.8],
    [51.6, -5.0],
  ],
  // Japan (Honshu / Kyushu)
  [
    [31.2, 130.6],
    [33.8, 134.5],
    [35.6, 140.8],
    [39.6, 142.0],
    [41.4, 140.8],
    [37.5, 137.2],
    [34.2, 131.0],
  ],
  // Sumatra
  [
    [5.6, 95.3],
    [1.5, 102.2],
    [-3.2, 105.8],
    [-5.9, 104.6],
    [-1.2, 100.2],
    [3.2, 96.5],
  ],
  // Java
  [
    [-6.0, 105.5],
    [-6.8, 111.0],
    [-8.4, 114.5],
    [-8.2, 110.2],
    [-6.9, 106.2],
  ],
  // Borneo
  [
    [6.8, 116.8],
    [4.2, 117.8],
    [-1.2, 116.9],
    [-3.5, 114.5],
    [-2.8, 110.2],
    [1.8, 109.4],
    [4.8, 114.2],
  ],
  // Philippines
  [
    [18.4, 120.6],
    [16.0, 122.0],
    [12.6, 124.2],
    [7.2, 126.4],
    [6.2, 124.2],
    [10.5, 122.0],
    [14.5, 120.4],
  ],
  // New Guinea
  [
    [-0.8, 131.2],
    [-2.5, 140.8],
    [-6.5, 147.8],
    [-10.2, 150.6],
    [-8.5, 143.5],
    [-8.2, 138.2],
    [-4.2, 134.0],
  ],
  // Australia
  [
    [-12.2, 131.0],
    [-12.0, 136.8],
    [-16.8, 139.2],
    [-11.0, 142.5],
    [-19.2, 146.8],
    [-27.5, 153.4],
    [-34.0, 151.2],
    [-38.4, 146.5],
    [-38.2, 141.0],
    [-35.0, 136.0],
    [-32.2, 132.5],
    [-32.0, 124.0],
    [-35.0, 117.8],
    [-34.0, 115.0],
    [-26.0, 113.5],
    [-21.8, 114.2],
    [-19.8, 120.5],
    [-15.0, 124.8],
    [-14.5, 129.5],
  ],
  // New Zealand
  [
    [-34.5, 172.8],
    [-37.8, 178.4],
    [-41.5, 175.2],
    [-46.2, 169.5],
    [-45.0, 167.0],
    [-40.8, 172.5],
  ],
  // North America
  [
    [70.0, -162.0],
    [60.0, -165.0],
    [58.0, -136.0],
    [48.5, -124.6],
    [34.0, -118.5],
    [23.0, -106.5],
    [16.0, -95.0],
    [8.5, -79.5],
    [18.2, -88.0],
    [21.2, -86.8],
    [19.5, -96.0],
    [26.0, -97.2],
    [29.8, -90.0],
    [25.2, -80.2],
    [35.2, -75.5],
    [41.5, -70.5],
    [45.0, -66.5],
    [47.5, -52.8],
    [58.0, -62.0],
    [68.0, -75.0],
    [71.0, -120.0],
  ],
  // South America
  [
    [11.2, -74.5],
    [10.5, -62.0],
    [5.0, -52.0],
    [-1.5, -48.0],
    [-5.8, -35.2],
    [-13.0, -38.5],
    [-23.0, -43.2],
    [-34.5, -54.0],
    [-42.0, -63.5],
    [-54.8, -66.5],
    [-53.0, -73.5],
    [-41.5, -73.8],
    [-23.5, -70.5],
    [-18.2, -70.8],
    [-12.0, -77.1],
    [-4.8, -81.2],
    [2.0, -78.8],
    [8.0, -77.5],
  ],
];

/** Ray-casting point-in-polygon check. */
function pointInRing(
  lat: number,
  lon: number,
  ring: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lonI] = ring[i];
    const [latJ, lonJ] = ring[j];
    if (lonI > lon !== lonJ > lon) {
      const latAtCross =
        latJ + ((lon - lonJ) / (lonI - lonJ)) * (latI - latJ);
      if (lat < latAtCross) inside = !inside;
    }
  }
  return inside;
}

export const isIndiaLand = (lat: number, lon: number): boolean =>
  pointInRing(lat, lon, INDIA_OUTLINE) || pointInRing(lat, lon, SRI_LANKA_RING);

export const INDIA_RINGS: [number, number][][] = [
  INDIA_OUTLINE,
  SRI_LANKA_RING,
];

export const INDIA_BOUNDS = {
  latMin: 6,
  latMax: 36,
  lonMin: 68,
  lonMax: 98,
} as const;

export function isLandmass(lat: number, lon: number): boolean {
  if (isIndiaLand(lat, lon)) return true;
  for (let i = 0; i < WORLD_CONTINENT_RINGS.length; i++) {
    if (pointInRing(lat, lon, WORLD_CONTINENT_RINGS[i])) return true;
  }
  return false;
}

export const isIndiaRegion = isIndiaLand;

/** Convert a closed ring of [lat, lon] into vertex pairs for <lineSegments>. */
function ringToLineSegments(
  ring: [number, number][],
  radius: number,
  maxSegmentDegrees = 3.5
): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [lat0, lon0] = ring[i];
    const [lat1, lon1] = ring[(i + 1) % ring.length];
    const dist = Math.hypot(lat1 - lat0, lon1 - lon0);
    const steps = Math.max(1, Math.ceil(dist / maxSegmentDegrees));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const v0 = latLonToVector3(
        lat0 + (lat1 - lat0) * t0,
        lon0 + (lon1 - lon0) * t0,
        radius
      );
      const v1 = latLonToVector3(
        lat0 + (lat1 - lat0) * t1,
        lon0 + (lon1 - lon0) * t1,
        radius
      );
      out.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
    }
  }
  return out;
}

/** Closed coastline line segments for India & Sri Lanka. */
export function buildIndiaCoastlineSegments(radius: number): Float32Array {
  const out: number[] = [];
  for (const ring of INDIA_RINGS) {
    out.push(...ringToLineSegments(ring, radius, 1.5));
  }
  return new Float32Array(out);
}

/** Closed coastline line segments for all world continents. */
export function buildWorldCoastlineSegments(radius: number): Float32Array {
  const out: number[] = [];
  for (const ring of WORLD_CONTINENT_RINGS) {
    out.push(...ringToLineSegments(ring, radius, 3.0));
  }
  return new Float32Array(out);
}

/** Backwards-compatible helper for ring position arrays. */
export function indiaCoastlinePositions(
  radius: number,
  rings: [number, number][][] = INDIA_RINGS
): Float32Array {
  const out: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i <= ring.length; i++) {
      const pt = ring[i % ring.length];
      const v = latLonToVector3(pt[0], pt[1], radius);
      out.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(out);
}

/**
 * Survey-grade graticule built as vertex pairs for <lineSegments> so meridians
 * and parallels never draw unwanted connecting lines between poles.
 */
export function buildGraticule(radius: number): {
  standard: Float32Array;
  equator: Float32Array;
  primeMeridian: Float32Array;
  tropicOfCancer: Float32Array;
} {
  const standard: number[] = [];
  const equator: number[] = [];
  const prime: number[] = [];
  const tropic: number[] = [];

  const pushPolylineAsSegments = (target: number[], pts: THREE.Vector3[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      target.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };

  // Meridians every 15 degrees
  for (let lon = -180; lon < 180; lon += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -84; lat <= 84; lat += 4) {
      pts.push(latLonToVector3(lat, lon, radius * 1.003));
    }
    if (lon === 0 || lon === 75) pushPolylineAsSegments(prime, pts);
    else pushPolylineAsSegments(standard, pts);
  }

  // Parallels every 15 degrees
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      pts.push(latLonToVector3(lat, lon, radius * 1.003));
    }
    if (lat === 0) pushPolylineAsSegments(equator, pts);
    else pushPolylineAsSegments(standard, pts);
  }

  // Tropic of Cancer (23.44° N — passes directly through Ahmedabad & Raipur)
  {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 3) {
      pts.push(latLonToVector3(23.44, lon, radius * 1.005));
    }
    pushPolylineAsSegments(tropic, pts);
  }

  return {
    standard: new Float32Array(standard),
    equator: new Float32Array(equator),
    primeMeridian: new Float32Array(prime),
    tropicOfCancer: new Float32Array(tropic),
  };
}

export const EARTH_CIRCUMFERENCE_KM = 40075;
export const KM_PER_UNIT = EARTH_CIRCUMFERENCE_KM / (2 * Math.PI);

export function indiaCoastProximity(lat: number, lon: number): number {
  let best = 99;
  for (let i = 0; i < INDIA_OUTLINE.length; i++) {
    const [a, b] = INDIA_OUTLINE[i];
    const d = (lat - a) * (lat - a) + (lon - b) * (lon - b);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function elevationKm(lat: number, lon: number): number {
  if (!isLandmass(lat, lon)) return -3.6;

  let km = 0.25;
  const band = (
    latMin: number,
    latMax: number,
    lonMin: number,
    lonMax: number,
    peakKm: number,
    falloffLat = 0
  ) => {
    if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) return 0;
    if (falloffLat === 0) return peakKm;
    const centre = (latMin + latMax) / 2;
    const ridge = Math.max(0, 1 - Math.abs(lat - centre) / falloffLat);
    return peakKm * ridge;
  };

  km = Math.max(km, band(27, 36, 72, 98, 5.8, 4.8)); // Himalayas & Tibetan plateau
  km = Math.max(km, band(11, 23, 73.5, 84, 1.2)); // Deccan + Western Ghats
  km = Math.max(km, band(23, 28.5, 72, 78, 0.9)); // Aravalli + Vindhya
  km = Math.max(km, band(42, 48.5, 5, 17, 3.2)); // Alps
  km = Math.max(km, band(14, 34, 36, 60, 1.5)); // Zagros / Arabian highlands
  km = Math.max(km, band(-12, 9, 29, 41, 2.0)); // East African Rift

  return km;
}

export function sceneSunVector(_now?: Date): THREE.Vector3 {
  // Fixed key-light direction that illuminates India, Europe, Africa and SE Asia
  // cleanly with a dramatic orbital terminator on the far western/Pacific limb.
  return new THREE.Vector3(0.45, 0.38, 0.81).normalize();
}

export function hillshade(
  lat: number,
  lon: number,
  sun: THREE.Vector3,
  zExaggeration = 1.4
): number {
  const eps = 0.7;
  const h = elevationKm(lat, lon);
  const hEast = elevationKm(lat, lon + eps);
  const hNorth = elevationKm(lat + eps, lon);

  const clampSlope = (v: number) => Math.max(-0.75, Math.min(0.75, v));
  const eastSlope = clampSlope(((hEast - h) / eps) * zExaggeration);
  const northSlope = clampSlope(((hNorth - h) / eps) * zExaggeration);

  const up = latLonToVector3(lat, lon, 1);
  const east = latLonToVector3(lat, lon + 1, 1).sub(up).normalize();
  const north = latLonToVector3(lat + 1, lon, 1).sub(up).normalize();

  const normal = up
    .clone()
    .addScaledVector(east, eastSlope)
    .addScaledVector(north, northSlope)
    .normalize();

  const lambert = Math.max(0, normal.dot(sun));
  return 0.68 + 0.32 * Math.pow(lambert, 0.75);
}

/**
 * Builds a high-contrast continental & India GIS dot matrix.
 * India is sampled at double density so the primary region of interest reads
 * with unmistakable topographic clarity.
 */
export function buildTerrainDotMatrix(
  step: number,
  oceanKeep: number,
  relief: number,
  sun: THREE.Vector3
): { positions: Float32Array; colors: Float32Array } {
  const coords: number[] = [];
  const colors: number[] = [];

  const signalOrange = new THREE.Color("#FE6E00");
  const warmAmber = new THREE.Color("#FFB74D");
  const hotIvory = new THREE.Color("#FFF3E0");
  const continentCyan = new THREE.Color("#7DD3FC");
  const continentSlate = new THREE.Color("#CBD5E1");
  const oceanBathymetry = new THREE.Color("#1E3A5F");
  const shadeTmp = new THREE.Color();

  // 1. Global sampling pass (continents + structured bathymetric grid)
  for (let lat = -76; lat <= 76; lat += step) {
    const radiusAtLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
    const lonStep = step / radiusAtLat;

    for (let lon = -180; lon < 180; lon += lonStep) {
      if (isIndiaLand(lat, lon)) continue; // Handled in high-density pass below

      const land = isLandmass(lat, lon);
      if (!land) {
        // Deterministic bathymetric lattice instead of random noise
        const gridMatch =
          Math.abs(lat % (step * 2.5)) < step * 0.45 &&
          Math.abs(lon % (step * 2.5)) < lonStep * 0.45;
        if (!gridMatch || oceanKeep <= 0) continue;
      }

      const radius = land
        ? 1.008 + Math.max(0, elevationKm(lat, lon)) * relief * 0.65
        : 1.002;
      const v = latLonToVector3(lat, lon, radius);
      coords.push(v.x, v.y, v.z);

      if (land) {
        const hash = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453) % 1;
        const baseCol =
          hash > 0.72
            ? warmAmber
            : hash > 0.35
            ? continentSlate
            : continentCyan;
        const shade = hillshade(lat, lon, sun);
        shadeTmp.copy(baseCol).multiplyScalar(shade * 0.88);
        colors.push(shadeTmp.r, shadeTmp.g, shadeTmp.b);
      } else {
        colors.push(
          oceanBathymetry.r * 0.55,
          oceanBathymetry.g * 0.55,
          oceanBathymetry.b * 0.55
        );
      }
    }
  }

  // 2. High-density India & Sri Lanka GIS pass (elevated holographic topography)
  const indiaStep = Math.max(0.85, step * 0.48);
  for (let lat = 5.5; lat <= 36.0; lat += indiaStep) {
    for (let lon = 68.0; lon <= 97.5; lon += indiaStep) {
      if (!isIndiaLand(lat, lon)) continue;

      const elev = Math.max(0.2, elevationKm(lat, lon));
      const radius = 1.016 + elev * relief;
      const v = latLonToVector3(lat, lon, radius);
      coords.push(v.x, v.y, v.z);

      const coastDist = indiaCoastProximity(lat, lon);
      const isBorder = coastDist < 1.6;
      const isHighland = elev > 2.2;

      if (isHighland) {
        shadeTmp.copy(warmAmber).lerp(hotIvory, 0.55);
      } else if (isBorder) {
        shadeTmp.copy(signalOrange).lerp(hotIvory, 0.42);
      } else {
        shadeTmp.copy(signalOrange).lerp(warmAmber, 0.38);
      }

      colors.push(shadeTmp.r, shadeTmp.g, shadeTmp.b);
    }
  }

  return {
    positions: new Float32Array(coords),
    colors: new Float32Array(colors),
  };
}

export function buildGreatCircleArc(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
  radius: number,
  lift: number
): THREE.QuadraticBezierCurve3 {
  const a = latLonToVector3(latA, lonA, radius);
  const b = latLonToVector3(latB, lonB, radius);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(radius + lift);
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

export interface Landmark {
  lat: number;
  lon: number;
  color: string;
}

export function buildLandmarkMarkers(landmarks: Landmark[]): {
  positions: Float32Array;
  colors: Float32Array;
} {
  const coords: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();

  for (const lm of landmarks) {
    const v = latLonToVector3(lm.lat, lm.lon, 1.024);
    coords.push(v.x, v.y, v.z);
    c.set(lm.color);
    colors.push(c.r, c.g, c.b);
  }

  return {
    positions: new Float32Array(coords),
    colors: new Float32Array(colors),
  };
}
