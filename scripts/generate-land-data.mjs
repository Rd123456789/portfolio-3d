/**
 * Regenerates src/lib/landData.ts from Natural Earth 1:50m land polygons
 * (public domain, redistributed as TopoJSON by the `world-atlas` package).
 *
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   node scripts/generate-land-data.mjs
 *
 * Output is three compact pieces the globe decodes at runtime:
 *   - a run-length encoded land/sea raster (dot matrix sampling + ocean shader)
 *   - simplified coastline polylines for the whole world
 *   - India's sea coast and Sri Lanka as readable [lat, lon] lists, cut out of
 *     the world polylines so the highlighted India outline never double-draws
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const topo = require("world-atlas/land-50m.json");
const { feature } = require("topojson-client");

const MASK_W = 720;
const MASK_H = 360;
const SIMPLIFY_DEG = 0.22;
const MIN_RING_SPAN_DEG = 1.1;
const QUANT = 50; // 0.02 degree coastline precision, fits int16

const land = feature(topo, topo.objects.land);
const polygons =
  land.type === "FeatureCollection"
    ? land.features.flatMap((f) => toPolygons(f.geometry))
    : toPolygons(land.geometry);

function toPolygons(geom) {
  return geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
}

// ---------------------------------------------------------------------------
// 1. Land raster (even-odd scanline fill across every ring, holes included)
// ---------------------------------------------------------------------------
const mask = new Uint8Array(MASK_W * MASK_H);
const allRings = polygons.flat();

for (let row = 0; row < MASK_H; row++) {
  const lat = -90 + (row + 0.5) * (180 / MASK_H);
  const crossings = [];
  for (const ring of allRings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      if (y0 > lat === y1 > lat) continue;
      crossings.push(x0 + ((lat - y0) / (y1 - y0)) * (x1 - x0));
    }
  }
  crossings.sort((a, b) => a - b);
  for (let k = 0; k + 1 < crossings.length; k += 2) {
    const from = Math.ceil((crossings[k] + 180) / (360 / MASK_W) - 0.5);
    const to = Math.floor((crossings[k + 1] + 180) / (360 / MASK_W) - 0.5);
    for (let col = Math.max(0, from); col <= Math.min(MASK_W - 1, to); col++) {
      mask[row * MASK_W + col] = 1;
    }
  }
}

// Alternating sea/land run lengths, starting with sea, as LEB128 varints
const runBytes = [];
let current = 0;
let run = 0;
const pushRun = (n) => {
  while (n >= 0x80) {
    runBytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  runBytes.push(n);
};
for (let i = 0; i < mask.length; i++) {
  if (mask[i] === current) run++;
  else {
    pushRun(run);
    current = mask[i];
    run = 1;
  }
}
pushRun(run);

// ---------------------------------------------------------------------------
// 2. Coastline polylines
// ---------------------------------------------------------------------------
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let worst = -1;
    let worstDist = tolerance * tolerance;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(
        0,
        Math.min(1, ((points[i][0] - ax) * dx + (points[i][1] - ay) * dy) / len2)
      );
      const ex = points[i][0] - (ax + t * dx);
      const ey = points[i][1] - (ay + t * dy);
      const d = ex * ex + ey * ey;
      if (d > worstDist) {
        worstDist = d;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Split a closed ring wherever it runs along the antimeridian or a pole. */
function splitArtificialEdges(ring) {
  const isSeam = (a, b) =>
    (Math.abs(a[0]) > 179.95 && Math.abs(b[0]) > 179.95) ||
    (Math.abs(a[1]) > 89.5 && Math.abs(b[1]) > 89.5) ||
    Math.abs(a[0] - b[0]) > 180;
  const lines = [];
  let line = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    if (isSeam(ring[i - 1], ring[i])) {
      if (line.length > 1) lines.push(line);
      line = [ring[i]];
    } else {
      line.push(ring[i]);
    }
  }
  if (line.length > 1) lines.push(line);
  // A ring with no seam is one closed loop; rejoin the wrap-around if split
  if (
    lines.length > 1 &&
    lines[0][0][0] === lines[lines.length - 1].at(-1)[0] &&
    lines[0][0][1] === lines[lines.length - 1].at(-1)[1]
  ) {
    const tail = lines.pop();
    lines[0] = tail.concat(lines[0].slice(1));
  }
  return lines;
}

const span = (ring) => {
  let minX = 999, maxX = -999, minY = 999, maxY = -999;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, size: Math.max(maxX - minX, maxY - minY) };
};

const nearest = (ring, lat, lon) => {
  let best = 0;
  let bestD = Infinity;
  ring.forEach(([x, y], i) => {
    const d = (x - lon) ** 2 + (y - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};

const worldLines = [];
let indiaCoast = null;
let sriLanka = null;

for (const polygon of polygons) {
  for (const ring of polygon) {
    const box = span(ring);
    if (box.size < MIN_RING_SPAN_DEG) continue;

    // Sri Lanka becomes part of the highlighted India hologram
    if (box.minX > 79 && box.maxX < 82.5 && box.minY > 5.5 && box.maxY < 10.2) {
      sriLanka = simplify(ring, SIMPLIFY_DEG * 0.6).slice(0, -1);
      continue;
    }

    // The Afro-Eurasian ring carries India's coast: Sir Creek -> Kanyakumari
    // -> Sundarbans. Cut that stretch out and keep the rest as world coast.
    const tipIdx = nearest(ring, 8.08, 77.55);
    const hasIndia =
      Math.hypot(ring[tipIdx][0] - 77.55, ring[tipIdx][1] - 8.08) < 0.6;
    if (hasIndia && !indiaCoast) {
      const open = ring.slice(0, -1);
      const west = nearest(open, 23.6, 68.15);
      const east = nearest(open, 21.75, 89.1);
      const tip = nearest(open, 8.08, 77.55);
      const walk = (from, to) => {
        const out = [];
        for (let i = from; ; i = (i + 1) % open.length) {
          out.push(open[i]);
          if (i === to) break;
        }
        return out;
      };
      let coast = walk(west, east);
      let rest = walk(east, west);
      const tipInCoast =
        west <= east ? tip >= west && tip <= east : tip >= west || tip <= east;
      if (!tipInCoast) {
        coast = walk(east, west).reverse();
        rest = walk(west, east);
      }
      indiaCoast = simplify(coast, SIMPLIFY_DEG * 0.6);
      for (const line of splitArtificialEdges(rest)) {
        worldLines.push(simplify(line, SIMPLIFY_DEG));
      }
      continue;
    }

    for (const line of splitArtificialEdges(ring)) {
      worldLines.push(simplify(line, SIMPLIFY_DEG));
    }
  }
}

if (!indiaCoast || !sriLanka) throw new Error("India / Sri Lanka not located");

const lineSizes = worldLines.map((l) => l.length);
const coords = new Int16Array(lineSizes.reduce((a, b) => a + b, 0) * 2);
let cursor = 0;
for (const line of worldLines) {
  for (const [lon, lat] of line) {
    coords[cursor++] = Math.round(lon * QUANT);
    coords[cursor++] = Math.round(lat * QUANT);
  }
}

const b64 = (typed) =>
  Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString(
    "base64"
  );
const latLonList = (pts) =>
  pts.map(([lon, lat]) => `[${lat.toFixed(2)}, ${lon.toFixed(2)}]`).join(", ");

const out = `// GENERATED by scripts/generate-land-data.mjs. Do not edit by hand.
// Source: Natural Earth 1:50m land polygons (public domain) via world-atlas.

/** Land raster dimensions: row 0 is the south pole, column 0 is 180 W. */
export const LAND_MASK_WIDTH = ${MASK_W};
export const LAND_MASK_HEIGHT = ${MASK_H};

/** Alternating sea/land run lengths (sea first) as base64 LEB128 varints. */
export const LAND_MASK_RLE =
  "${Buffer.from(runBytes).toString("base64")}";

/** Coastline vertices as base64 little-endian int16 [lon, lat] * ${QUANT}. */
export const COAST_QUANT = ${QUANT};
export const COAST_POINTS =
  "${b64(coords)}";

/** Vertex count of each open coastline polyline, in COAST_POINTS order. */
export const COAST_LINE_SIZES: number[] = [${lineSizes.join(",")}];

/** India's sea coast, Sir Creek -> Kanyakumari -> Sundarbans, as [lat, lon]. */
export const INDIA_SEA_COAST: [number, number][] = [${latLonList(indiaCoast)}];

/** Sri Lanka as a closed [lat, lon] ring. */
export const SRI_LANKA_COAST: [number, number][] = [${latLonList(sriLanka)}];
`;

const target = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/landData.ts"
);
writeFileSync(target, out);
console.log(
  `landData.ts: ${worldLines.length} lines, ${coords.length / 2} coast points, ` +
    `${indiaCoast.length} India coast points, ${runBytes.length} mask bytes, ` +
    `${(out.length / 1024).toFixed(1)} KB`
);
