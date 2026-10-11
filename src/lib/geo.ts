import * as THREE from "three";

/**
 * Shared geospatial helpers for the globe assets (desktop + mobile).
 * Pure functions and pre-built buffers only — nothing here touches React state,
 * so both canvas variants can stay in sync without duplicating the map data.
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

// Deterministic hash so coastlines are stable across reloads and builds.
function hash2(ix: number, iy: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function jitter(v: number, amp: number): number {
  return (hash2(Math.floor(v * 2.0), 7.31) - 0.5) * 2 * amp;
}

/**
 * India's outline as a closed lat/lon ring, walked from the Rann of Kutch. This
 * is the one landmass the portfolio actually tells a story about (Ahmedabad HQ,
 * Raipur CSPDCL, Rajasthan solar), so it is drawn from real geography instead
 * of a coarse rectangle.
 */
const INDIA_OUTLINE: [number, number][] = [
  [23.7, 68.2], [24.0, 68.8], [23.0, 69.5], [22.5, 70.0], [22.2, 70.8],
  [21.5, 71.0], [20.9, 70.4], [20.0, 70.5], [19.0, 72.0], [18.5, 72.9],
  [17.0, 73.2], [15.5, 73.8], [14.5, 74.3], [12.5, 74.8], [10.0, 76.2],
  [8.9, 77.4], [8.08, 77.55], [9.3, 78.3], [9.9, 78.9], [11.0, 79.2],
  [12.2, 79.8], [13.1, 80.3], [15.0, 80.3], [16.5, 81.5], [17.5, 82.5],
  [19.0, 84.5], [20.0, 86.5], [21.5, 87.0], [22.0, 88.5], [21.8, 89.0],
  [22.5, 89.5], [24.0, 89.0], [25.0, 89.5], [26.0, 89.7], [25.5, 90.5],
  [25.0, 92.0], [26.5, 94.0], [27.5, 95.5], [28.0, 97.0], [29.0, 94.5],
  [28.5, 92.0], [30.0, 91.0], [31.0, 89.5], [28.2, 88.2], [27.2, 88.2],
];

/** Himalayan + Ganges plain states sit north of the Nepal/Bhutan corridor. */
const INDIA_NORTH_RING: [number, number][] = [
  [28.0, 77.0], [30.5, 79.0], [31.5, 82.0], [32.5, 85.0], [33.0, 87.0],
  [32.0, 88.0], [31.0, 89.5], [27.0, 88.5], [26.5, 84.0], [27.5, 80.0],
  [28.5, 77.5],
];

/** Standard ray-casting point-in-ring test. */
function pointInRing(lat: number, lon: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lonI] = ring[i];
    const [latJ, lonJ] = ring[j];
    if (lonI > lon !== lonJ > lon) {
      const latAtCross = latJ + ((lon - lonJ) / (lonI - lonJ)) * (latI - latJ);
      if (lat < latAtCross) inside = !inside;
    }
  }
  return inside;
}

export const isIndiaLand = (lat: number, lon: number): boolean =>
  pointInRing(lat, lon, INDIA_OUTLINE) ||
  pointInRing(lat, lon, INDIA_NORTH_RING);

/** Coastal outline rings, exported so the renderer can draw them as line loops. */
export const INDIA_RINGS: [number, number][][] = [INDIA_OUTLINE, INDIA_NORTH_RING];

export const INDIA_BOUNDS = { latMin: 6, latMax: 36, lonMin: 68, lonMax: 98 } as const;

/**
 * Survey-grade graticule: meridians and parallels at true 15-degree intervals,
 * matching a real globe's engraving. The equator and prime meridian are
 * returned separately so they can be emphasised.
 */
export function buildGraticule(radius: number): {
  standard: Float32Array;
  equator: Float32Array;
  primeMeridian: Float32Array;
} {
  const standard: number[] = [];
  const equator: number[] = [];
  const prime: number[] = [];

  const pushLine = (target: number[], pts: number[]) => {
    for (const p of pts) target.push(p);
  };

  // Meridians every 15 degrees of longitude
  for (let lon = -180; lon < 180; lon += 15) {
    const pts: number[] = [];
    for (let lat = -90; lat <= 90; lat += 3) {
      const v = latLonToVector3(lat, lon, radius * 1.004);
      pts.push(v.x, v.y, v.z);
    }
    if (lon === 0) pushLine(prime, pts);
    else pushLine(standard, pts);
  }

  // Parallels every 15 degrees of latitude
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts: number[] = [];
    for (let lon = -180; lon <= 180; lon += 3) {
      const v = latLonToVector3(lat, lon, radius * 1.004);
      pts.push(v.x, v.y, v.z);
    }
    if (lat === 0) pushLine(equator, pts);
    else pushLine(standard, pts);
  }

  return {
    standard: new Float32Array(standard),
    equator: new Float32Array(equator),
    primeMeridian: new Float32Array(prime),
  };
}

/**
 * Scale bar in the globe's own units. At 1 unit radius the circumference is
 * 2*PI*6371 km, so `km` maps onto a real ground distance — the bar is labelled
 * honestly rather than dividing an arbitrary ruler.
 */
export const EARTH_CIRCUMFERENCE_KM = 40075;
export const KM_PER_UNIT = EARTH_CIRCUMFERENCE_KM / (2 * Math.PI);

/**
 * Flattened vertex buffer for the real coastline, ready to attach to a
 * BufferGeometry as a line loop. Closing the ring is the consumer's job.
 */
export function indiaCoastlinePositions(
  radius: number,
  rings: [number, number][][] = [INDIA_OUTLINE, INDIA_NORTH_RING]
): Float32Array {
  const out: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const v = latLonToVector3(ring[i][0], ring[i][1], radius);
      out.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(out);
}

/**
 * Points lying within `band` degrees of the real coastline, used to draw a
 * coastline emphasis line rather than a filled silhouette.
 */
export function isNearIndiaCoast(lat: number, lon: number, band = 1.2): boolean {
  for (let i = 0; i < INDIA_OUTLINE.length; i++) {
    const [a, b] = INDIA_OUTLINE[i];
    if (Math.abs(lat - a) < band && Math.abs(lon - b) < band) return true;
  }
  return (
    pointInRing(lat + band, lon, INDIA_OUTLINE) !== pointInRing(lat - band, lon, INDIA_OUTLINE) ||
    pointInRing(lat, lon + band, INDIA_OUTLINE) !== pointInRing(lat, lon - band, INDIA_OUTLINE)
  );
}

/**
 * Distance from the nearest coastline point, in degrees. Drives per-dot coast
 * shading: shallow water lighter, deep interior darker.
 */
export function indiaCoastProximity(lat: number, lon: number): number {
  let best = 99;
  for (let i = 0; i < INDIA_OUTLINE.length; i++) {
    const [a, b] = INDIA_OUTLINE[i];
    const d = (lat - a) * (lat - a) + (lon - b) * (lon - b);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// Coarse continental regions: [latMin, latMax, lonMin, lonMax]. These carry
// world context around the accurately drawn region of interest.
const LAND_REGIONS: [number, number, number, number][] = [
  // Southeast Asia
  [1.0, 8.0, 99.0, 104.5], // Malay peninsula
  [5.0, 25.0, 95.0, 110.0], // Indochina
  [-6.0, 6.0, 95.0, 106.0], // Sumatra
  [-8.5, -5.0, 105.0, 115.0], // Java
  [-4.0, 7.0, 108.0, 119.0], // Borneo
  [-6.0, 2.0, 118.0, 126.0], // Sulawesi
  [-10.0, 1.0, 130.0, 151.0], // New Guinea
  // East & Central Asia
  [20.0, 45.0, 100.0, 123.0], // China
  [41.0, 53.0, 87.0, 121.0], // Mongolia
  [50.0, 70.0, 60.0, 180.0], // Siberia
  [30.0, 45.0, 128.0, 143.0], // Japan
  [-11.0, 7.0, 128.0, 140.0], // Philippines
  // Middle East & Arabia
  [12.0, 40.0, 35.0, 62.0],
  [12.0, 30.0, 35.0, 57.0], // Arabian peninsula
  // Europe & Scandinavia
  [36.0, 60.0, -10.0, 42.0],
  [55.0, 71.0, 4.0, 31.0], // Scandinavia
  [-8.0, 2.0, 50.0, 59.0], // UK & Ireland
  // Africa
  [-17.0, 33.0, -18.0, 37.0], // North Africa
  [2.0, 13.0, 40.0, 52.0], // Horn of Africa
  [-35.0, -12.0, 11.0, 42.0], // Southern Africa
  [-25.0, -12.0, 42.0, 51.0], // Madagascar
  // Americas
  [55.0, 71.0, -168.0, -140.0], // Alaska
  [48.0, 70.0, -141.0, -55.0], // Canada
  [25.0, 49.0, -125.0, -70.0], // United States
  [15.0, 32.0, -117.0, -90.0], // Mexico
  [7.0, 18.0, -92.0, -77.0], // Central America
  [12.0, -1.0, -81.0, -50.0], // Northern South America
  [-20.0, -1.0, -75.0, -34.0], // Amazonia
  [-40.0, -19.0, -73.0, -53.0], // Southern cone
  [-55.0, -39.0, -75.0, -60.0], // Tierra del Fuego
  // Oceania
  [-40.0, -10.0, 112.0, 155.0], // Australia
  [-44.0, -40.0, 144.0, 149.0], // Tasmania
  [-45.0, -33.0, 166.0, 179.0], // New Zealand
];

export function isLandmass(lat: number, lon: number): boolean {
  // The region of interest uses real geometry first
  if (isIndiaLand(lat, lon)) return true;

  // Context continents keep a jittered edge so they do not read as boxes
  const jLat = lat + jitter(lat, 1.15);
  const jLon = lon + jitter(lon, 1.15);

  for (let i = 0; i < LAND_REGIONS.length; i++) {
    const r = LAND_REGIONS[i];
    if (jLat >= r[0] && jLat <= r[1] && jLon >= r[2] && jLon <= r[3]) return true;
  }
  return false;
}

export const isIndiaRegion = isIndiaLand;

/**
 * Continental dot-matrix buffers for a globe of the given sampling density.
 * `step` is in degrees; coastal ocean points are kept sparsely as a telemetry
 * texture, land points get the high-density pass. India's coastline is
 * distance-shaded so the shore reads as a gradient rather than a hard edge.
 */
export function buildDotMatrix(
  step: number,
  oceanKeep: number
): { positions: Float32Array; colors: Float32Array } {
  const coords: number[] = [];
  const colors: number[] = [];

  const orange = new THREE.Color("#FE6E00");
  const orangeWarm = new THREE.Color("#FFB74D");
  const white = new THREE.Color("#FFFFFF");
  const steel = new THREE.Color("#4A4A4A");

  for (let lat = -80; lat <= 80; lat += step) {
    const radiusAtLat = Math.cos((lat * Math.PI) / 180);
    const lonStep = Math.max(step, step / (radiusAtLat || 0.1));

    for (let lon = -180; lon < 180; lon += lonStep) {
      const land = isLandmass(lat, lon);
      if (!land && Math.random() > oceanKeep) continue;

      const india = isIndiaLand(lat, lon);
      const radius = land ? (india ? 1.026 : 1.02) : 1.01;
      const v = latLonToVector3(lat, lon, radius);

      coords.push(v.x, v.y, v.z);

      if (india) {
        // Shore-adjacent dots burn brighter: this is the coastal GIS story
        const coastProximity = indiaCoastProximity(lat, lon);
        const coastal = coastProximity < 2.5 ? 1 - coastProximity / 2.5 : 0;
        const base = orange.clone().lerp(white, coastal * 0.55);
        colors.push(base.r, base.g, base.b);
      } else if (land) {
        const col = Math.random() > 0.35 ? white : (Math.random() > 0.5 ? orangeWarm : steel);
        colors.push(col.r, col.g, col.b);
      } else {
        colors.push(steel.r, steel.g, steel.b);
      }
    }
  }

  return { positions: new Float32Array(coords), colors: new Float32Array(colors) };
}

/**
 * Approximate mean elevation in kilometres for a lat/lon sample. Real ranges
 * for the belts visible on this globe, so high terrain pokes out of the core
 * sphere rather than sitting on a smooth ball.
 */
export function elevationKm(lat: number, lon: number): number {
  let km = 0.05; // lowland default

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

  // Himalaya + Karakoram + Tibetan plateau edge
  km = Math.max(km, band(27, 37, 70, 100, 6.4, 5.0));
  // Tibetan plateau
  km = Math.max(km, band(29, 36, 78, 96, 4.8, 3.5));
  // Deccan plateau
  km = Math.max(km, band(11, 24, 74, 85, 0.75));
  // Aravalli range
  km = Math.max(km, band(23.5, 28.5, 72.5, 78, 0.6));
  // Western Ghats
  km = Math.max(km, band(8, 21, 73, 77.5, 1.2));
  // Vindhya / Satpura
  km = Math.max(km, band(21, 24.5, 73, 82, 0.55));
  // Andes
  km = Math.max(km, band(-56, 13, -81, -62, 5.8, 34));
  // Rockies / Sierra Nevada
  km = Math.max(km, band(31, 60, -127, -105, 2.2));
  // Appalachians
  km = Math.max(km, band(33, 47, -85, -73, 1.3));
  // Alps / Pyrenees / Caucasus
  km = Math.max(km, band(43, 48.5, 4, 17, 3.6));
  km = Math.max(km, band(40, 45, 38, 48, 3.4));
  // Scandinavian range
  km = Math.max(km, band(58, 66, 5, 15, 1.5));
  // East African rift highlands
  km = Math.max(km, band(-12, 7, 29, 40, 1.9));
  // Atlas
  km = Math.max(km, band(28, 37, -9, 10, 2.4));
  // Great Dividing Range
  km = Math.max(km, band(-38, -20, 145, 153, 1.1));
  // Southern Alps (NZ)
  km = Math.max(km, band(-46, -41, 167, 174, 2.6));
  // Urals
  km = Math.max(km, band(51, 68, 55, 65, 1.2));

  // Ocean floor: continents stand proud of the abyssal plain
  if (!isLandmass(lat, lon)) {
    const depth = Math.abs(lat) > 60 ? 4.2 : 3.6;
    return -depth;
  }
  return km;
}

/**
 * Sun direction for the globe's lighting.
 *
 * The true sub-solar point is the wrong choice here: for roughly half of every
 * day it puts the entire camera-facing hemisphere in darkness, and the asset
 * reads as an empty black ball. This anchors the light on the viewer's side so
 * the terminator is always visible across the disc, while the tilt still follows
 * the real solar declination, so the season genuinely changes the look.
 */
export function sceneSunVector(now: Date): THREE.Vector3 {
  const start = new Date(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - start.getTime()) / 86400000
  );
  const declinationRad =
    ((-23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * Math.PI) /
      180);

  return new THREE.Vector3(
    0.5,
    Math.sin(declinationRad) * 1.3 + 0.1,
    1
  ).normalize();
}

/**
 * Real sub-solar unit vector for a given instant, so the relief shading and the
 * day/night terminator agree with the actual sun.
 */
export function subSolarVector(now: Date): THREE.Vector3 {
  const start = new Date(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - start.getTime()) / 86400000
  );
  const declination =
    -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const subLon = 180 - utcMinutes * 0.25;
  const phi = (90 - declination) * (Math.PI / 180);
  const theta = (subLon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(Math.sin(phi) * Math.cos(theta)),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).normalize();
}

/**
 * World-space hillshade for a surface point. Elevation is sampled at small
 * offsets in the local east/north tangent plane to build a true 3D normal, then
 * shaded against the sun — the same way a GIS client renders a relief layer.
 *
 * `zExaggeration` scales the vertical gradient. Real terrain is nearly flat at
 * globe scale (6 km of relief against a 6371 km radius), so a modest value gives
 * readable slope shading without turning range cliffs into black holes.
 */
export function hillshade(
  lat: number,
  lon: number,
  sun: THREE.Vector3,
  zExaggeration = 1.5
): number {
  const eps = 0.6; // degrees of sampling offset

  const h = elevationKm(lat, lon);
  const hEast = elevationKm(lat, lon + eps);
  const hNorth = elevationKm(lat + eps, lon);

  // Slope as rise over run, gently exaggerated for legibility
  const slopeEast = ((hEast - h) / eps) * zExaggeration;
  const slopeNorth = ((hNorth - h) / eps) * zExaggeration;

  // Clamp so discontinuous DEM band edges cannot produce cliff-black regions
  const clampSlope = (v: number) => Math.max(-0.85, Math.min(0.85, v));
  const eastSlope = clampSlope(slopeEast);
  const northSlope = clampSlope(slopeNorth);

  // Local tangent basis at this point
  const up = latLonToVector3(lat, lon, 1);
  const east = latLonToVector3(lat, lon + 1, 1).sub(up).normalize();
  const north = latLonToVector3(lat + 1, lon, 1).sub(up).normalize();

  // Surface normal from the (exaggerated) height gradient
  const normal = up
    .clone()
    .addScaledVector(east, eastSlope)
    .addScaledVector(north, northSlope)
    .normalize();

  const lambert = Math.max(0, normal.dot(sun));
  // Ambient fill keeps shadowed slopes legible; the range stays inside a band
  // where dots are always clearly visible against the core sphere.
  return 0.55 + 0.45 * Math.pow(lambert, 0.8);
}

/**
 * Dot-matrix buffers whose land points are radially displaced by the elevation
 * field and shaded by world-space hillshade, so relief is real geometry that
 * catches light instead of a flat texture.
 */
export function buildTerrainDotMatrix(
  step: number,
  oceanKeep: number,
  relief: number,
  sun: THREE.Vector3
): { positions: Float32Array; colors: Float32Array } {
  const coords: number[] = [];
  const colors: number[] = [];

  const orange = new THREE.Color("#FE6E00");
  const orangeWarm = new THREE.Color("#FFB74D");
  const white = new THREE.Color("#FFFFFF");
  const steel = new THREE.Color("#4A4A4A");
  const shadeTmp = new THREE.Color();

  for (let lat = -80; lat <= 80; lat += step) {
    const radiusAtLat = Math.cos((lat * Math.PI) / 180);
    const lonStep = Math.max(step, step / (radiusAtLat || 0.1));

    for (let lon = -180; lon < 180; lon += lonStep) {
      const land = isLandmass(lat, lon);
      if (!land && Math.random() > oceanKeep) continue;

      // Only land carries relief. The ocean floor is left flat and, critically,
      // never pushed below the core sphere radius — inside it, depth testing
      // hides the dots completely.
      const radius = land
        ? 1.02 + elevationKm(lat, lon) * relief
        : 1.012;
      const v = latLonToVector3(lat, lon, radius);

      coords.push(v.x, v.y, v.z);

      let col: THREE.Color;
      if (isIndiaLand(lat, lon)) {
        const coastProximity = indiaCoastProximity(lat, lon);
        const coastal = coastProximity < 2.5 ? 1 - coastProximity / 2.5 : 0;
        col = orange.clone().lerp(white, coastal * 0.55);
      } else if (land) {
        col = Math.random() > 0.35 ? white : (Math.random() > 0.5 ? orangeWarm : steel);
      } else {
        col = steel;
      }

      // Relief shading, then a day/night factor. Without the terminator the
      // geography stays equally bright on the night side and drowns out the
      // city lights, which should be the only thing visible after dark.
      const shade = hillshade(lat, lon, sun);
      const normal = latLonToVector3(lat, lon, 1);
      const day = THREE.MathUtils.smoothstep(normal.dot(sun), -0.12, 0.4);
      const nightFloor = 0.08;
      shadeTmp
        .copy(col)
        .multiplyScalar(shade * (nightFloor + (1 - nightFloor) * day));
      colors.push(shadeTmp.r, shadeTmp.g, shadeTmp.b);
    }
  }

  return { positions: new Float32Array(coords), colors: new Float32Array(colors) };
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

/**
 * Named-location markers for the globe. Rendered as one additive points object
 * so every city costs a single draw call.
 */
export function buildLandmarkMarkers(landmarks: Landmark[]): {
  positions: Float32Array;
  colors: Float32Array;
} {
  const coords: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();

  for (const lm of landmarks) {
    const v = latLonToVector3(lm.lat, lm.lon, 1.03);
    coords.push(v.x, v.y, v.z);
    c.set(lm.color);
    colors.push(c.r, c.g, c.b);
  }

  return { positions: new Float32Array(coords), colors: new Float32Array(colors) };
}
