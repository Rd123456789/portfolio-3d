import * as THREE from "three";
import {
  COAST_LINE_SIZES,
  COAST_POINTS,
  COAST_QUANT,
  INDIA_SEA_COAST,
  LAND_MASK_HEIGHT,
  LAND_MASK_RLE,
  LAND_MASK_WIDTH,
  SRI_LANKA_COAST,
} from "./landData";

/**
 * Geospatial geometry builders for the Planetary GIS Command Globe.
 *
 * The world's land comes from Natural Earth (see landData.ts): a land/sea
 * raster drives the dot matrix and the ocean shader, and real coastline
 * polylines replace hand-drawn continent shapes. Everything is emitted as
 * vertex pairs for <lineSegments> so no stray chords connect separate lines.
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

/**
 * India's land frontier, Sundarbans -> North-East -> Himalayas -> Rajasthan,
 * continuing from where the sea coast ends and closing back at Sir Creek.
 */
const INDIA_LAND_FRONTIER: [number, number][] = [
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

/** Closed outline of India: surveyed sea coast plus the land frontier. */
export const INDIA_OUTLINE: [number, number][] = [
  ...INDIA_SEA_COAST,
  ...INDIA_LAND_FRONTIER,
];

export const INDIA_RINGS: [number, number][][] = [
  INDIA_OUTLINE,
  SRI_LANKA_COAST,
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
  lat > 5 &&
  lat < 36 &&
  lon > 68 &&
  lon < 98 &&
  (pointInRing(lat, lon, INDIA_OUTLINE) ||
    pointInRing(lat, lon, SRI_LANKA_COAST));

function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let landMaskCache: Uint8Array | null = null;

/**
 * Land raster, one byte per cell (255 = land). Row 0 is the south pole and
 * column 0 is 180 W, which is exactly how a sphere's UVs sample a texture.
 */
export function getLandMask(): {
  data: Uint8Array;
  width: number;
  height: number;
} {
  if (!landMaskCache) {
    const runs = decodeBase64(LAND_MASK_RLE);
    const mask = new Uint8Array(LAND_MASK_WIDTH * LAND_MASK_HEIGHT);
    let cell = 0;
    let isLand = false;
    for (let i = 0; i < runs.length; ) {
      let length = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = runs[i++];
        length |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte & 0x80);
      if (isLand) mask.fill(255, cell, cell + length);
      cell += length;
      isLand = !isLand;
    }
    landMaskCache = mask;
  }
  return {
    data: landMaskCache,
    width: LAND_MASK_WIDTH,
    height: LAND_MASK_HEIGHT,
  };
}

export function isLandmass(lat: number, lon: number): boolean {
  if (isIndiaLand(lat, lon)) return true;
  const { data, width, height } = getLandMask();
  const wrapped = ((((lon + 180) % 360) + 360) % 360) / 360;
  const col = Math.min(width - 1, Math.floor(wrapped * width));
  const row = Math.min(
    height - 1,
    Math.max(0, Math.floor(((lat + 90) / 180) * height))
  );
  return data[row * width + col] > 0;
}

/** Append one [lat, lon] edge, subdivided so it hugs the sphere. */
function pushEdge(
  out: number[],
  lat0: number,
  lon0: number,
  lat1: number,
  lon1: number,
  radius: number,
  maxSegmentDegrees: number
): void {
  const dist = Math.hypot(lat1 - lat0, lon1 - lon0);
  const steps = Math.max(1, Math.ceil(dist / maxSegmentDegrees));
  let prev = latLonToVector3(lat0, lon0, radius);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const next = latLonToVector3(
      lat0 + (lat1 - lat0) * t,
      lon0 + (lon1 - lon0) * t,
      radius
    );
    out.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
    prev = next;
  }
}

/** Closed coastline line segments for India & Sri Lanka. */
export function buildIndiaCoastlineSegments(radius: number): Float32Array {
  const out: number[] = [];
  for (const ring of INDIA_RINGS) {
    for (let i = 0; i < ring.length; i++) {
      const [lat0, lon0] = ring[i];
      const [lat1, lon1] = ring[(i + 1) % ring.length];
      pushEdge(out, lat0, lon0, lat1, lon1, radius, 1.5);
    }
  }
  return new Float32Array(out);
}

/**
 * Coastline segments for every landmass except India's own shore, which the
 * highlighted India outline draws instead.
 */
export function buildWorldCoastlineSegments(radius: number): Float32Array {
  const bytes = decodeBase64(COAST_POINTS);
  const view = new DataView(bytes.buffer);
  const out: number[] = [];
  let cursor = 0;
  for (const size of COAST_LINE_SIZES) {
    for (let i = 0; i < size - 1; i++) {
      const at = (cursor + i) * 4;
      pushEdge(
        out,
        view.getInt16(at + 2, true) / COAST_QUANT,
        view.getInt16(at, true) / COAST_QUANT,
        view.getInt16(at + 6, true) / COAST_QUANT,
        view.getInt16(at + 4, true) / COAST_QUANT,
        radius,
        3
      );
    }
    cursor += size;
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

/** Distance in degrees from a point to the nearest edge of India's outline. */
export function indiaCoastProximity(lat: number, lon: number): number {
  let best = Infinity;
  for (let i = 0; i < INDIA_OUTLINE.length; i++) {
    const [aLat, aLon] = INDIA_OUTLINE[i];
    const [bLat, bLon] = INDIA_OUTLINE[(i + 1) % INDIA_OUTLINE.length];
    const dLat = bLat - aLat;
    const dLon = bLon - aLon;
    const len2 = dLat * dLat + dLon * dLon || 1e-9;
    const t = Math.max(
      0,
      Math.min(1, ((lat - aLat) * dLat + (lon - aLon) * dLon) / len2)
    );
    const d = Math.hypot(lat - (aLat + t * dLat), lon - (aLon + t * dLon));
    if (d < best) best = d;
  }
  return best;
}

/** Coarse relief model: enough to lift the ranges the globe actually shows. */
export function elevationKm(lat: number, lon: number): number {
  let km = 0.25;
  const range = (
    latMin: number,
    latMax: number,
    lonMin: number,
    lonMax: number,
    peakKm: number
  ) => {
    if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) return;
    // Ridge profile: peaks along the centre line, easing out to the foothills
    const acrossLat = 1 - Math.abs(lat - (latMin + latMax) / 2) / ((latMax - latMin) / 2);
    const acrossLon = 1 - Math.abs(lon - (lonMin + lonMax) / 2) / ((lonMax - lonMin) / 2);
    const ridge = Math.min(1, acrossLat * 1.6) * Math.min(1, acrossLon * 3);
    km = Math.max(km, 0.25 + (peakKm - 0.25) * ridge);
  };

  range(27, 37, 72, 104, 5.6); // Himalayas & Tibetan plateau
  range(9, 21, 73, 78, 1.3); // Western Ghats
  range(13, 24, 76, 84, 0.9); // Deccan plateau
  range(23, 28.5, 72, 78, 0.9); // Aravalli + Vindhya
  range(43.5, 48.5, 5, 16, 3.2); // Alps
  range(27, 39, 44, 62, 2.4); // Zagros & Iranian plateau
  range(35, 43, 67, 82, 3.6); // Hindu Kush, Pamir & Tien Shan
  range(-4, 14, 33, 41, 2.2); // Ethiopian highlands & East African Rift
  range(-48, 8, -79, -66, 3.8); // Andes
  range(33, 56, -124, -105, 2.4); // Rockies

  return km;
}

export function sceneSunVector(): THREE.Vector3 {
  // Fixed key-light direction in view space: high and front-right, so the
  // hemisphere facing the camera reads as day with a soft terminator behind.
  return new THREE.Vector3(0.45, 0.38, 0.81).normalize();
}

export interface TerrainDotMatrix {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
}

/**
 * Builds the continental dot matrix: a hex-staggered halftone of every
 * landmass, with India resampled at more than double density and lifted onto
 * exaggerated relief so the region of interest reads first.
 */
export function buildTerrainDotMatrix(
  step: number,
  relief: number
): TerrainDotMatrix {
  const coords: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];

  const signalOrange = new THREE.Color("#FE6E00");
  const warmAmber = new THREE.Color("#FFB74D");
  const hotIvory = new THREE.Color("#FFF3E0");
  const lowland = new THREE.Color("#58779B");
  const upland = new THREE.Color("#B4C6DA");
  const tint = new THREE.Color();

  // 1. Global pass. Alternate rows are offset by half a step so the dots pack
  //    as a halftone instead of lining up into visible meridian columns.
  let row = 0;
  for (let lat = -78; lat <= 82; lat += step, row++) {
    const lonStep = step / Math.max(0.12, Math.cos((lat * Math.PI) / 180));
    const offset = row % 2 === 0 ? 0 : lonStep * 0.5;

    for (let lon = -180 + offset; lon < 180; lon += lonStep) {
      if (!isLandmass(lat, lon) || isIndiaLand(lat, lon)) continue;

      const elev = elevationKm(lat, lon);
      const v = latLonToVector3(lat, lon, 1.006 + elev * relief * 0.5);
      coords.push(v.x, v.y, v.z);

      const height = Math.min(1, elev / 3.2);
      tint.copy(lowland).lerp(upland, height);
      colors.push(tint.r, tint.g, tint.b);
      sizes.push(0.8 + height * 0.22);
    }
  }

  // 2. High-density India & Sri Lanka pass (elevated holographic topography)
  const indiaStep = Math.max(0.62, step * 0.42);
  row = 0;
  for (let lat = 5.6; lat <= 36.2; lat += indiaStep, row++) {
    const offset = row % 2 === 0 ? 0 : indiaStep * 0.5;
    for (let lon = 68.0 + offset; lon <= 97.6; lon += indiaStep) {
      if (!isIndiaLand(lat, lon)) continue;

      const elev = elevationKm(lat, lon);
      const v = latLonToVector3(lat, lon, 1.016 + elev * relief);
      coords.push(v.x, v.y, v.z);

      if (elev > 2.2) {
        tint.copy(warmAmber).lerp(hotIvory, 0.6);
      } else if (indiaCoastProximity(lat, lon) < 0.9) {
        tint.copy(signalOrange).lerp(hotIvory, 0.38);
      } else {
        tint.copy(signalOrange).lerp(warmAmber, 0.3 + Math.min(0.4, elev * 0.3));
      }
      colors.push(tint.r, tint.g, tint.b);
      sizes.push(0.78 + Math.min(0.5, elev * 0.12));
    }
  }

  return {
    positions: new Float32Array(coords),
    colors: new Float32Array(colors),
    sizes: new Float32Array(sizes),
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
