# Context Handoff — "improve assets three cycles" (portfolio-3d)

User request: **"improve assets three cycles"** — improve the portfolio's 3D canvas
assets (globe = hero, drone = works, mast = contact) through three measured
improvement cycles. A session goal is active for exactly this objective.

## How to resume after restart

1. Read this file. Re-read `src/lib/shaders.ts` around the areas listed below
   before editing (line numbers shift).
2. Start the dev server (npm.ps1 is blocked by PowerShell execution policy):
   - `background_process`: `cmd /c npm run dev`, ready on port 3000.
3. Screenshots (Playwright + local SwiftShader; run **one at a time**, parallel
   Chrome instances stall the 30 s screenshot timeout):
   - `node shoot_asset.js globe <tag> [--mobile] [--canvas] [--zoom=l,t,w,h]`
   - `node shoot_asset.js drone <tag> ...`
   - `node shoot_asset.js mast <tag> ...`
   - `--canvas` hides the scroll container and **collapses asset staging**
     (wrong asset can bleed in) — do not use it for drone/mast.
   - Useful crops: globe `--zoom=900,60,700,920`; drone `--zoom=780,380,660,400`;
     mast `--zoom=800,60,780,920`.
4. Verify visually with the read tool on the PNGs, then continue Cycle 2 edits
   (plan below), then Cycle 3.
5. Re-run `cmd /c npx tsc --noEmit` (~4 min, must pass). `npm run lint` has 66
   pre-existing errors in files this work does not touch (admin page,
   rainy-store, Particles, Navbar, etc.) — only ensure no NEW errors at edit sites.
6. Finish with `goal_report` (complete) + per-cycle summary text. Do not commit.

## State: Cycle 1 COMPLETE + verified (tsc clean)

### Globe (GeospatialGlobe.tsx, GeospatialGlobeMobile.tsx, shaders.ts)
- Removed redundant wireframe lat/lon sphere (it duplicated the graticule).
- Root cause of the scratchy grey "hatched ribbon" on the limb: the graticule /
  coastline **line rings** (and to a lesser degree the dot matrix) piling up
  edge-on at the silhouette. Fixes:
  - `TERRAIN_POINTS_VERTEX/FRAGMENT` (shaders.ts): added `vGrazing`
    smoothstep fade via `normalMatrix` normal vs view dir.
  - New `createGlobeGridLineMaterial()` (shaders.ts, GRID_LINE_VERTEX/FRAGMENT):
    same grazing fade for lines; applied to graticule standard/equator/prime +
    coastline rings in both desktop and mobile globes (replaced lineBasicMaterial).
- Evidence: `shot_globe_cy1z.png` (scratchy band) vs `shot_globe_after1e.png`
  (clean limb). Mobile: `shot_globe_m-after1full.png`.
- Debug shots kept: `shot_globe_exp1.png` (experiment, graticule hidden).
- Trap fixed: a duplicated `</line>` tag during editing; tsc confirms clean now.

### Drone (AutonomousDroneAsset.tsx, MobileDroneScout.tsx)
- Rotor blur disc intensity 0.5 → 0.85; blades opacity 0.9 → 0.45 so the
  additive blur reads through them like a fast-spinning prop. Mobile scout
  disc 0.45 → 0.8.
- Evidence: `shot_drone_cy1z.png` / `shot_drone_after1z2.png` (subtle but real:
  softer smeared blades + visible disc arcs). Rotor read is still weak at the
  staged camera angle — see Cycle 2 candidates.

### Mast (GridNetworkAsset.tsx)
- Brushed-steel lid on the SCADA cabinet (y 1.45), machined cap on the rotating
  LIDAR head (y 1.75), RTU status readout emissive 4 → 2.6, LIDAR LED 3 → 2.4
  so the mint-green slabs stop looking "pasted on".
- Evidence: `shot_mast_cy1z.png` vs `shot_mast_after1z.png`.

## State: Cycle 2 COMPLETE + verified (tsc clean)

- **Globe**: tighter terminator `smoothstep(-0.18, 0.72)` + warmer day side
  (`uLit` `#4E2E12`) in `CORE_FRAGMENT`/`createGlobeCoreMaterial` (shaders.ts).
  Evidence: `shot_globe_after1e.png` vs `shot_globe_after2.png`.
- **Drone**: airframe lightened (chassis `#313845`, shell `#2A3039`, arms
  `#2E353F`), nav strobes r 0.022 → 0.03, emissive 4 → 5.5 (same in
  MobileDroneScout). Evidence: `shot_drone_cy3.png`, `shot_drone_after2.png`.
- **Mast**: guy wires 0.3 → 0.2, span marker 0.5 → 0.35, RTU display seated in a
  dark bezel, hazard plate metallic `#C9C9C9`. Evidence: `shot_mast_after2.png`.

## State: Cycle 3 COMPLETE + verified (tsc clean)

- **Globe**: night-side dot floor 0.08 → 0.12 (`nightFloor`, geo.ts) so the
  continent field stays faintly readable after dark. Evidence: `shot_globe_after3.png`.
- **Drone**: rotor disc intensity 0.85 → 0.75 (balance the glow), camera turret
  `#141414` → `#23262B` so the gimbal reads as hardware. Evidence: `shot_drone_after3.png`.
- **Mast**: fixed stainless stem connecting SCADA cabinet to the rotating LIDAR
  head (no more floating head). Evidence: `shot_mast_after3.png`.
- Mobile sanity: `shot_drone_m-after3.png` — MobileDroneScout reads well.

## Wrap-up status

All three cycles done. `cmd /c npx tsc --noEmit` passes. Scoped eslint on the
touched files shows only the same pre-existing `react-hooks/immutability` errors
(landmarkMaterial/coreMaterial/coronaMaterial/pulsePositions) that existed before
this work — no new lint findings at any edit site. Nothing committed.

If more polish is ever wanted: rotor read at extreme edge-on angles, mast
upper-cross-arm suspension strings (real double-circuit towers carry strings on
both arms), and the mobile hero card's opacity (DOM, out of asset scope).

## Files touched by this session (all uncommitted)

- `src/lib/shaders.ts` — terrain dot grazing fade; new globe grid line material.
- `src/components/canvas/GeospatialGlobe.tsx` — wireframe sphere removed, grid
  materials wired, disposal updated.
- `src/components/canvas/GeospatialGlobeMobile.tsx` — same grid materials.
- `src/components/canvas/AutonomousDroneAsset.tsx` — rotor blur + blades.
- `src/components/canvas/MobileDroneScout.tsx` — rotor blur.
- `src/components/canvas/GridNetworkAsset.tsx` — mast top housings + readouts.
- (Pre-existing session-start edits, not mine: Experience.tsx, Lighting.tsx,
  geo.ts diffs were already in the tree when work started.)

## Screenshot inventory (project root)

Cy1 baselines: `shot_globe_cy1.png`, `shot_globe_cy1z.png`, `shot_drone_cy1.png`,
`shot_drone_cy1z.png`, `shot_mast_cy1.png`, `shot_mast_cy1z.png`
Cy1 after: `shot_globe_after1.png` (wireframe-only removal), `shot_globe_after1b/c/d/e.png`
(limb fix iterations), `shot_globe_m-after1.png`, `shot_globe_m-after1full.png`,
`shot_drone_after1z.png`, `shot_drone_after1z2.png`, `shot_mast_after1z.png`
Experiment: `shot_globe_exp1.png`

Cy2: `shot_globe_after2.png`, `shot_drone_after2.png`, `shot_mast_after2.png`
Cy3 baselines: `shot_globe_cy3.png`, `shot_drone_cy3.png`, `shot_mast_cy3.png`
Cy3 after: `shot_globe_after3.png`, `shot_drone_after3.png`, `shot_mast_after3.png`,
`shot_drone_m-after3.png`
