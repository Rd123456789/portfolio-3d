"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Project } from "@/lib/projects";
import {
  createRotorDiscMaterial,
  createScanCurtainMaterial,
  createTerrainDeckMaterial,
  setUniform,
  setUniformColor,
} from "@/lib/shaders";

interface AutonomousDroneAssetProps {
  activeProject?: Project | null;
  position?: [number, number, number];
  scale?: number;
  /** Lighter build for phones: coarser terrain mesh and fewer segments. */
  lite?: boolean;
}

const PROJECT_THEME: Record<string, string> = {
  "cspdcl-gis": "#FE6E00", // Signal Orange
  "track-fields": "#38BDF8", // Telemetry Cyan
  "kishan-guru": "#10B981", // Agri Emerald
  "solar-mapping": "#FFB74D", // Solar Gold
};

// Where each project's diorama sits on the survey deck, as [x, z]
const SECTOR_TARGET: Record<string, [number, number]> = {
  "cspdcl-gis": [-0.52, -0.42],
  "solar-mapping": [0.54, -0.42],
  "kishan-guru": [-0.52, 0.46],
  "track-fields": [0.52, 0.46],
};

const DECK_WIDTH = 2.36;
const DECK_DEPTH = 2.16;
const DECK_Y = -0.96;
const TERRAIN_PEAK = 0.3;
const HOVER_Y = 0.66;
const ROTOR_RADIUS = 0.62;
const AIRFRAME_SCALE = 1.14;

// LiDAR emitter under the gimbal, in the airframe's own coordinates
const EMITTER: [number, number, number] = [0, -0.37, 0.24];

const UP = new THREE.Vector3(0, 1, 0);

/** Places a unit-height cylinder so it spans from `a` to `b`. */
function strut(a: [number, number, number], b: [number, number, number]) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  return {
    position: va.clone().add(vb).multiplyScalar(0.5),
    quaternion: new THREE.Quaternion().setFromUnitVectors(
      UP,
      dir.clone().normalize()
    ),
    length: dir.length(),
  };
}

/** Elevation of the surveyed terrain at normalised deck coordinates (-1..1). */
function terrainHeight(nx: number, nz: number): number {
  const ridge1 =
    Math.exp(-((nx + 0.35) ** 2 * 3.2 + (nz + 0.25) ** 2 * 2.8)) * 0.26;
  const ridge2 =
    Math.exp(-((nx - 0.4) ** 2 * 3.5 + (nz - 0.3) ** 2 * 3.0)) * 0.2;
  const wave = Math.sin(nx * 3.5) * Math.cos(nz * 3.2) * 0.04;
  return Math.max(0.01, ridge1 + ridge2 + wave + 0.03);
}

/** Terrain elevation at a point given in deck coordinates. */
function deckHeight(x: number, z: number): number {
  return terrainHeight((x / DECK_WIDTH) * 2, (z / DECK_DEPTH) * 2);
}

/** A rectangular parcel draped over the relief, a hair above the surface. */
function buildDrapedParcel(
  cx: number,
  cz: number,
  width: number,
  depth: number
): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(width, depth, 16, 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(cx, 0, cz);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, deckHeight(pos.getX(i), pos.getZ(i)) + 0.007);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A closed boundary traced over the relief, as line-segment vertex pairs. */
function buildDrapedBoundary(corners: [number, number][]): Float32Array {
  const out: number[] = [];
  const steps = 14;
  corners.forEach(([x0, z0], i) => {
    const [x1, z1] = corners[(i + 1) % corners.length];
    for (let s = 0; s < steps; s++) {
      for (const t of [s / steps, (s + 1) / steps]) {
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        out.push(x, deckHeight(x, z) + 0.012, z);
      }
    }
  });
  return new Float32Array(out);
}

/**
 * The digital-twin surface: a displaced, lit mesh whose rim drops to the deck
 * so the relief reads as a solid milled block rather than a floating sheet.
 */
function buildTerrainSurface(cols: number, rows: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(DECK_WIDTH, DECK_DEPTH, cols, rows);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = (pos.getX(i) / DECK_WIDTH) * 2;
    const nz = (pos.getZ(i) / DECK_DEPTH) * 2;
    const onRim = Math.abs(nx) > 0.9999 || Math.abs(nz) > 0.9999;
    pos.setY(i, onRim ? 0 : terrainHeight(nx, nz));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Fan with its apex at the origin, reaching one unit down and one unit wide. */
function buildCurtainFan(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, -1, -1, 0, 1, -1, 0]),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0.5, 0, 0, 1, 1, 1]), 2)
  );
  return geometry;
}

// Sector A: three distribution pylons stepping across the north-west ridge
const PYLONS: [number, number][] = [
  [-0.92, -0.68],
  [-0.5, -0.36],
  [-0.08, -0.1],
];
const PYLON_HEIGHT = 0.22;

/** Twin catenary conductors strung between the diorama's three pylons. */
function buildMiniGridLines(): Float32Array {
  const tops = PYLONS.map(
    ([x, z]) => new THREE.Vector3(x, deckHeight(x, z) + PYLON_HEIGHT * 0.8, z)
  );
  const verts: number[] = [];
  for (let p = 0; p < tops.length - 1; p++) {
    for (const offset of [-0.055, 0.055]) {
      const a = tops[p].clone().add(new THREE.Vector3(0, 0, offset));
      const b = tops[p + 1].clone().add(new THREE.Vector3(0, 0, offset));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y -= 0.045;
      const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10);
      for (let i = 0; i < pts.length - 1; i++) {
        verts.push(pts[i].x, pts[i].y, pts[i].z);
        verts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      }
    }
  }
  return new Float32Array(verts);
}

// Sector C: four NDVI crop rows. Sector D: a surveyed field boundary.
const CROP_ROWS = [-0.22, -0.07, 0.08, 0.23].map((dz) => 0.48 + dz);
const GPS_CORNERS: [number, number][] = [
  [0.24, 0.26],
  [0.8, 0.26],
  [0.8, 0.7],
  [0.24, 0.7],
];

/** Compass graduations around the diorama as one line-segment batch. */
function buildCompassTicks(radius: number): Float32Array {
  const out: number[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const length = i % 12 === 0 ? 0.11 : i % 4 === 0 ? 0.06 : 0.028;
    out.push(
      Math.cos(a) * (radius - length),
      0,
      Math.sin(a) * (radius - length),
      Math.cos(a) * radius,
      0,
      Math.sin(a) * radius
    );
  }
  return new Float32Array(out);
}

// Motor positions: front pair forward (-Z), port side on -X
const ARMS = [
  { x: 0.88, z: -0.84, dir: 1, isPort: false },
  { x: -0.88, z: -0.84, dir: -1, isPort: true },
  { x: -0.88, z: 0.84, dir: 1, isPort: true },
  { x: 0.88, z: 0.84, dir: -1, isPort: false },
].map((arm) => ({
  ...arm,
  boom: strut(
    [Math.sign(arm.x) * 0.22, 0.02, Math.sign(arm.z) * 0.38],
    [arm.x, 0.07, arm.z]
  ),
}));

const SKID_STRUTS = [-1, 1].flatMap((side) =>
  [-0.26, 0.26].map((z) => ({
    key: `${side}-${z}`,
    ...strut([side * 0.2, -0.07, z], [side * 0.43, -0.36, z * 1.25]),
  }))
);

export default function AutonomousDroneAsset({
  activeProject,
  position = [0, 0, 0],
  scale = 1.0,
  lite = false,
}: AutonomousDroneAssetProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const droneBodyRef = useRef<THREE.Group>(null!);
  const gimbalRef = useRef<THREE.Group>(null!);
  const laserCurtainRef = useRef<THREE.Group>(null!);
  const targetReticleRef = useRef<THREE.Group>(null!);
  const waypointDiamondRef = useRef<THREE.Mesh>(null!);
  const compassRingRef = useRef<THREE.Group>(null!);
  const strobeRef = useRef<THREE.Mesh>(null!);
  const rotorRefs = useRef<(THREE.Group | null)[]>([]);

  // Match exact project IDs from src/lib/projects.ts
  const projectId = activeProject?.id ?? "cspdcl-gis";
  const themeColor = PROJECT_THEME[projectId] ?? "#FE6E00";
  const sectorTarget = SECTOR_TARGET[projectId] ?? [0, 0];

  const terrainGeometry = useMemo(
    () => (lite ? buildTerrainSurface(56, 52) : buildTerrainSurface(104, 96)),
    [lite]
  );
  const curtainGeometry = useMemo(() => buildCurtainFan(), []);
  const miniGridLines = useMemo(() => buildMiniGridLines(), []);
  const cropParcels = useMemo(
    () => CROP_ROWS.map((z) => buildDrapedParcel(-0.54, z, 0.74, 0.1)),
    []
  );
  const gpsBoundary = useMemo(() => buildDrapedBoundary(GPS_CORNERS), []);
  const compassTicks = useMemo(() => buildCompassTicks(1.95), []);

  // Built once, then re-tinted in place when the active project changes
  const rotorDiscMaterial = useMemo(() => createRotorDiscMaterial(), []);
  const curtainMaterial = useMemo(
    () => createScanCurtainMaterial("#FE6E00"),
    []
  );
  const terrainMaterial = useMemo(
    () => createTerrainDeckMaterial({ theme: "#FE6E00", maxHeight: TERRAIN_PEAK }),
    []
  );

  useEffect(() => {
    setUniformColor(rotorDiscMaterial, "uColor", themeColor);
    setUniformColor(curtainMaterial, "uColor", themeColor);
    setUniformColor(terrainMaterial, "uTheme", themeColor);
  }, [themeColor, rotorDiscMaterial, curtainMaterial, terrainMaterial]);

  useEffect(
    () => () => {
      rotorDiscMaterial.dispose();
      curtainMaterial.dispose();
      terrainMaterial.dispose();
      curtainGeometry.dispose();
      cropParcels.forEach((g) => g.dispose());
    },
    [
      rotorDiscMaterial,
      curtainMaterial,
      terrainMaterial,
      curtainGeometry,
      cropParcels,
    ]
  );
  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Isometric stage orientation + responsive cursor parallax
    if (rootGroupRef.current) {
      const targetRotX = 0.36 - state.pointer.y * 0.12;
      const targetRotY =
        -0.38 + state.pointer.x * 0.22 + Math.sin(t * 0.35) * 0.06;
      rootGroupRef.current.rotation.x = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.x,
        targetRotX,
        4,
        delta
      );
      rootGroupRef.current.rotation.y = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.y,
        targetRotY,
        4,
        delta
      );
    }

    // 2. UAV precision hover & subtle flight banking
    const hoverY = HOVER_Y + Math.sin(t * 2.1) * 0.04;
    const body = droneBodyRef.current;
    if (body) {
      body.position.y = hoverY;
      body.position.x = Math.sin(t * 0.9) * 0.06;

      const bankZ = -Math.cos(t * 0.9) * 0.045 - state.pointer.x * 0.08;
      const pitchX = 0.07 + Math.sin(t * 1.1) * 0.025;
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, bankZ, 5, delta);
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, pitchX, 5, delta);
    }

    // 3. Rotors. Alternate pairs counter-rotate, as on a real quad.
    rotorRefs.current.forEach((rotor, idx) => {
      if (rotor) rotor.rotation.y += delta * 34 * ARMS[idx].dir;
    });

    // 4. LiDAR sweep: the terrain shader paints the return line, and the
    //    curtain is aimed from the emitter to exactly that line on the deck.
    const sweep = Math.sin(t * 1.05);
    const scanZ = sweep * (DECK_DEPTH / 2 - 0.1);
    setUniform(terrainMaterial, "uScanZ", scanZ);
    setUniform(terrainMaterial, "uScanDir", Math.cos(t * 1.05) >= 0 ? 1 : -1);

    if (laserCurtainRef.current && body) {
      const drop = hoverY + EMITTER[1] * AIRFRAME_SCALE - (DECK_Y + 0.07);
      const reach = scanZ - EMITTER[2] * AIRFRAME_SCALE;
      const curtain = laserCurtainRef.current;
      curtain.rotation.x = -Math.atan2(reach, drop) - body.rotation.x;
      curtain.scale.set(
        (DECK_WIDTH / 2 - 0.04) / AIRFRAME_SCALE,
        Math.hypot(reach, drop) / AIRFRAME_SCALE,
        1
      );
    }

    // 5. Gimbal tracks the active project sector
    if (gimbalRef.current) {
      const targetYaw = state.pointer.x * 0.25 + sectorTarget[0] * 0.5;
      gimbalRef.current.rotation.y = THREE.MathUtils.damp(
        gimbalRef.current.rotation.y,
        targetYaw,
        5,
        delta
      );
    }

    // 6. Active Project Target Lock Reticle + Floating Waypoint Beacon
    if (targetReticleRef.current) {
      targetReticleRef.current.position.x = THREE.MathUtils.damp(
        targetReticleRef.current.position.x,
        sectorTarget[0],
        5,
        delta
      );
      targetReticleRef.current.position.z = THREE.MathUtils.damp(
        targetReticleRef.current.position.z,
        sectorTarget[1],
        5,
        delta
      );
      targetReticleRef.current.position.y = THREE.MathUtils.damp(
        targetReticleRef.current.position.y,
        deckHeight(sectorTarget[0], sectorTarget[1]) + 0.09,
        5,
        delta
      );
      targetReticleRef.current.rotation.y = t * 0.8;
    }
    if (waypointDiamondRef.current) {
      waypointDiamondRef.current.rotation.y = -t * 1.8;
      waypointDiamondRef.current.position.y = 0.3 + Math.sin(t * 3.0) * 0.03;
    }

    // 7. Anti-collision strobe: a short double flash each second
    if (strobeRef.current) {
      const beat = t % 1.1;
      const on = beat < 0.07 || (beat > 0.16 && beat < 0.23);
      (
        strobeRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = on ? 9 : 0.6;
    }

    if (compassRingRef.current) compassRingRef.current.rotation.y = t * 0.16;
  });

  const carbon = (
    <meshStandardMaterial color="#232A35" metalness={0.6} roughness={0.36} />
  );
  const steel = (
    <meshStandardMaterial color="#AEB8C5" metalness={1} roughness={0.26} />
  );
  const glow = (intensity: number) => (
    <meshStandardMaterial
      color={themeColor}
      emissive={themeColor}
      emissiveIntensity={intensity}
      toneMapped={false}
    />
  );

  return (
    <group
      ref={rootGroupRef}
      position={position}
      scale={scale}
      rotation={[0.36, -0.38, 0]}
    >
      {/* Project-accent fill: tints the scene without drowning the materials */}
      <pointLight
        position={[0.4, 0.2, 1.6]}
        intensity={1.3}
        color={themeColor}
        distance={7}
      />

      {/* =====================================================================
          TIER 1: INDUSTRIAL AUTONOMOUS SURVEY UAV (HOVERING ABOVE DECK)
      ===================================================================== */}
      <group
        ref={droneBodyRef}
        position={[0, HOVER_Y, 0]}
        scale={AIRFRAME_SCALE}
      >
        {/* The airframe is modelled nose-to-(-Z); turn it to face the viewer */}
        <group rotation={[0, Math.PI, 0]}>
        {/* 1. Airframe: carbon chassis under a light composite weather shell */}
        <RoundedBox
          args={[0.6, 0.16, 1.04]}
          radius={0.07}
          smoothness={4}
          position={[0, -0.015, 0]}
        >
          {carbon}
        </RoundedBox>

        <RoundedBox
          args={[0.56, 0.15, 0.9]}
          radius={0.07}
          smoothness={5}
          position={[0, 0.085, -0.03]}
        >
          <meshStandardMaterial
            color="#D7DDE5"
            metalness={0.12}
            roughness={0.36}
          />
        </RoundedBox>

        {/* Recessed battery hatch with a status bar and charge telltales */}
        <RoundedBox
          args={[0.27, 0.02, 0.4]}
          radius={0.009}
          smoothness={2}
          position={[0, 0.158, 0.12]}
        >
          <meshStandardMaterial color="#12161C" metalness={0.1} roughness={0.6} />
        </RoundedBox>
        {[0, 1, 2, 3].map((cell) => (
          <mesh key={`cell-${cell}`} position={[-0.075 + cell * 0.05, 0.17, 0.27]}>
            <boxGeometry args={[0.032, 0.006, 0.014]} />
            <meshBasicMaterial color="#10B981" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.17, -0.02]}>
          <boxGeometry args={[0.2, 0.006, 0.016]} />
          {glow(2.4)}
        </mesh>

        {/* Theme chines along the shell split line */}
        {[-1, 1].map((side) => (
          <mesh key={`chine-${side}`} position={[side * 0.292, 0.03, -0.02]}>
            <boxGeometry args={[0.01, 0.014, 0.62]} />
            {glow(2.6)}
          </mesh>
        ))}

        {/* Forward sensor visor: gloss black bar housing the stereo pair */}
        <RoundedBox
          args={[0.44, 0.085, 0.07]}
          radius={0.03}
          smoothness={3}
          position={[0, 0.06, -0.485]}
        >
          <meshStandardMaterial color="#06080B" metalness={0.9} roughness={0.1} />
        </RoundedBox>
        {[-0.12, 0.12].map((xOff) => (
          <group key={`eye-${xOff}`} position={[xOff, 0.06, -0.522]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.027, 0.027, 0.012, 20]} />
              {steel}
            </mesh>
            <mesh position={[0, 0, -0.0065]} rotation={[0, Math.PI, 0]}>
              <circleGeometry args={[0.019, 20]} />
              <meshBasicMaterial color="#38BDF8" toneMapped={false} />
            </mesh>
          </group>
        ))}

        {/* Dual RTK-GNSS mushroom antennas */}
        {[-0.15, 0.15].map((xOff) => (
          <group key={`rtk-${xOff}`} position={[xOff, 0.16, 0.3]}>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.012, 0.016, 0.06, 10]} />
              {steel}
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.05, 0.042, 0.026, 24]} />
              <meshStandardMaterial
                color="#F1F4F8"
                metalness={0.1}
                roughness={0.32}
              />
            </mesh>
            <mesh position={[0, 0.058, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.046, 0.004, 6, 24]} />
              {glow(2)}
            </mesh>
          </group>
        ))}

        {/* Dorsal anti-collision strobe */}
        <mesh ref={strobeRef} position={[0, 0.172, -0.3]}>
          <sphereGeometry args={[0.022, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FFFFFF"
            emissiveIntensity={0.6}
            toneMapped={false}
          />
        </mesh>

        {/* 2. Landing gear: splayed struts onto capsule skids */}
        {SKID_STRUTS.map((s) => (
          <mesh key={`gear-${s.key}`} position={s.position} quaternion={s.quaternion}>
            <cylinderGeometry args={[0.013, 0.016, s.length, 8]} />
            {carbon}
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <group key={`skid-${side}`} position={[side * 0.43, -0.36, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.018, 0.9, 4, 10]} />
              {carbon}
            </mesh>
            {[-0.43, 0.43].map((zEnd) => (
              <mesh key={zEnd} position={[0, 0, zEnd]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.0215, 0.0215, 0.07, 12]} />
                {glow(1.6)}
              </mesh>
            ))}
          </group>
        ))}

        {/* 3. Tapered carbon booms, brushless motors and rotors */}
        {ARMS.map((arm, i) => (
          <group key={`arm-${i}`}>
            <mesh position={arm.boom.position} quaternion={arm.boom.quaternion}>
              <cylinderGeometry args={[0.024, 0.04, arm.boom.length, 14]} />
              {carbon}
            </mesh>

            <group position={[arm.x, 0.07, arm.z]}>
              {/* Arm-end clamp carrying the navigation light */}
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.07, 0.058, 0.05, 20]} />
                {carbon}
              </mesh>
              <mesh position={[0, -0.056, 0]}>
                <sphereGeometry args={[0.024, 10, 8]} />
                <meshBasicMaterial
                  color={arm.isPort ? "#FF3B3B" : "#22E08A"}
                  toneMapped={false}
                />
              </mesh>

              {/* Motor bell with a theme-anodised band */}
              <mesh position={[0, 0.036, 0]}>
                <cylinderGeometry args={[0.062, 0.066, 0.064, 24]} />
                {steel}
              </mesh>
              <mesh position={[0, 0.036, 0]}>
                <cylinderGeometry args={[0.0675, 0.0675, 0.018, 24]} />
                {glow(1.1)}
              </mesh>

              {/* Spinning hub, blades and their motion smear */}
              <group
                ref={(el) => {
                  rotorRefs.current[i] = el;
                }}
                position={[0, 0.088, 0]}
              >
                <mesh>
                  <cylinderGeometry args={[0.016, 0.03, 0.04, 14]} />
                  {steel}
                </mesh>

                {[-1, 1].map((bladeDir) => (
                  <group
                    key={bladeDir}
                    rotation={[0.1 * arm.dir * bladeDir, 0, 0]}
                  >
                    <mesh
                      position={[bladeDir * 0.36, 0.008, 0]}
                      scale={[0.34, 0.005, 0.044]}
                    >
                      <sphereGeometry args={[1, 16, 8]} />
                      <meshStandardMaterial
                        color="#10141A"
                        metalness={0.4}
                        roughness={0.4}
                        transparent
                        opacity={0.42}
                        depthWrite={false}
                      />
                    </mesh>
                  </group>
                ))}

                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, 0.008, 0]}
                  material={rotorDiscMaterial}
                >
                  <circleGeometry args={[ROTOR_RADIUS, lite ? 32 : 48]} />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        {/* 4. Underslung stabilised payload: mapping camera over a LiDAR head */}
        <group ref={gimbalRef} position={[0, -0.1, -0.24]}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.062, 0.035, 20]} />
            {carbon}
          </mesh>
          {/* Yoke */}
          <mesh position={[0, -0.03, 0]}>
            <boxGeometry args={[0.25, 0.022, 0.05]} />
            {carbon}
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={`yoke-${side}`} position={[side * 0.117, -0.09, 0]}>
              <boxGeometry args={[0.018, 0.12, 0.05]} />
              {carbon}
            </mesh>
          ))}
          {/* Camera ball */}
          <mesh position={[0, -0.12, 0]}>
            <sphereGeometry args={[0.092, 24, 18]} />
            <meshStandardMaterial
              color="#C9D0D9"
              metalness={0.2}
              roughness={0.34}
            />
          </mesh>
          <mesh position={[0, -0.125, -0.072]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.054, 0.05, 24]} />
            <meshStandardMaterial color="#090B0F" metalness={0.9} roughness={0.14} />
          </mesh>
          <mesh position={[0, -0.125, -0.098]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.036, 24]} />
            <meshStandardMaterial
              color="#0B1E33"
              emissive="#38BDF8"
              emissiveIntensity={0.55}
              metalness={1}
              roughness={0.05}
            />
          </mesh>
          {/* LiDAR emitter head */}
          <mesh position={[0, -0.235, 0]}>
            <cylinderGeometry args={[0.04, 0.032, 0.05, 20]} />
            {carbon}
          </mesh>
          <mesh position={[0, -0.262, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 0.008, 20]} />
            {glow(4)}
          </mesh>
        </group>

        </group>

        {/* 5. Sweeping LiDAR curtain, aimed every frame at the deck's scan line */}
        <group ref={laserCurtainRef} position={EMITTER}>
          <mesh geometry={curtainGeometry} material={curtainMaterial} />
        </group>
      </group>

      {/* =====================================================================
          TIER 2: DIGITAL-TWIN TERRAIN & PROJECT DIORAMA DECK
      ===================================================================== */}
      <group position={[0, DECK_Y, 0]}>
        {/* Machined plinth */}
        <RoundedBox
          args={[2.6, 0.15, 2.4]}
          radius={0.03}
          smoothness={3}
          position={[0, -0.078, 0]}
        >
          <meshStandardMaterial
            color="#1A202A"
            metalness={0.9}
            roughness={0.34}
          />
        </RoundedBox>

        {/* Luminous Perimeter Frame & Corner Benchmarks */}
        {[-1, 1].map((side) => (
          <React.Fragment key={`frame-${side}`}>
            <mesh position={[0, 0.001, side * 1.14]}>
              <boxGeometry args={[2.48, 0.008, 0.012]} />
              {glow(2.2)}
            </mesh>
            <mesh position={[side * 1.24, 0.001, 0]}>
              <boxGeometry args={[0.012, 0.008, 2.28]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={0.7} />
            </mesh>
          </React.Fragment>
        ))}

        {[
          [-1.24, -1.14],
          [1.24, -1.14],
          [-1.24, 1.14],
          [1.24, 1.14],
        ].map(([cx, cz], idx) => (
          <group key={`fid-${idx}`} position={[cx, 0.014, cz]}>
            <mesh>
              <cylinderGeometry args={[0.04, 0.048, 0.04, 6]} />
              {steel}
            </mesh>
            <mesh position={[0, 0.024, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.01, 6]} />
              {glow(2.4)}
            </mesh>
          </group>
        ))}

        {/* Surveyed terrain: contours, grid and LiDAR sweep live in the shader */}
        <mesh geometry={terrainGeometry} material={terrainMaterial} />

        {/* SECTOR A (NW): CSPDCL Electrical Distribution Corridor */}
        <group>
          {PYLONS.map(([px, pz], idx) => (
            <group key={`pylon-${idx}`} position={[px, deckHeight(px, pz) - 0.01, pz]}>
              <mesh position={[0, PYLON_HEIGHT / 2, 0]}>
                <cylinderGeometry args={[0.008, 0.03, PYLON_HEIGHT, 4]} />
                <meshStandardMaterial
                  color={projectId === "cspdcl-gis" ? "#FE6E00" : "#AEB8C5"}
                  emissive={projectId === "cspdcl-gis" ? "#FE6E00" : "#000000"}
                  emissiveIntensity={projectId === "cspdcl-gis" ? 1.2 : 0}
                  metalness={0.9}
                  roughness={0.3}
                  wireframe
                />
              </mesh>
              {[0.6, 0.8].map((at, armIdx) => (
                <mesh
                  key={at}
                  position={[0, PYLON_HEIGHT * at, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                >
                  <boxGeometry args={[armIdx === 0 ? 0.13 : 0.11, 0.007, 0.007]} />
                  <meshBasicMaterial
                    color={projectId === "cspdcl-gis" ? "#FFB74D" : "#CBD5E1"}
                  />
                </mesh>
              ))}
              <mesh position={[0, PYLON_HEIGHT + 0.006, 0]}>
                <sphereGeometry args={[0.011, 8, 8]} />
                <meshBasicMaterial color="#FE6E00" toneMapped={false} />
              </mesh>
            </group>
          ))}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[miniGridLines, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#FE6E00"
              transparent
              opacity={projectId === "cspdcl-gis" ? 0.95 : 0.45}
            />
          </lineSegments>
        </group>

        {/* SECTOR B (NE): Rooftop Solar CAD Array (France Solar Project) */}
        <group position={[0.56, deckHeight(0.56, -0.44) + 0.05, -0.44]}>
          <RoundedBox
            args={[0.72, 0.1, 0.56]}
            radius={0.012}
            smoothness={2}
            position={[0, -0.04, 0]}
          >
            <meshStandardMaterial color="#2A3340" metalness={0.3} roughness={0.6} />
          </RoundedBox>
          {[-0.22, 0, 0.22].map((rx, rIdx) =>
            [-0.16, -0.05, 0.06, 0.17].map((cz, cIdx) => (
              <mesh
                key={`solar-${rIdx}-${cIdx}`}
                position={[rx, 0.032, cz]}
                rotation={[0.3, 0, 0]}
              >
                <boxGeometry args={[0.18, 0.006, 0.085]} />
                <meshStandardMaterial
                  color="#12265C"
                  emissive={
                    projectId === "solar-mapping" ? "#FFB74D" : "#1D4ED8"
                  }
                  emissiveIntensity={
                    projectId === "solar-mapping" ? 0.9 : 0.25
                  }
                  metalness={1}
                  roughness={0.16}
                />
              </mesh>
            ))
          )}
        </group>

        {/* SECTOR C (SW): KishanGuru Digital Agriculture NDVI Terraces */}
        {cropParcels.map((parcel, rIdx) => (
          <mesh key={`crop-${rIdx}`} geometry={parcel}>
            <meshStandardMaterial
              color="#0B6B4F"
              emissive="#10B981"
              emissiveIntensity={
                projectId === "kishan-guru" ? 1.3 - rIdx * 0.22 : 0.16
              }
              roughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/* SECTOR D (SE): Track-Fields GPS Boundary Demarcation */}
        {GPS_CORNERS.map(([bx, bz], bIdx) => (
          <group key={`gps-${bIdx}`} position={[bx, deckHeight(bx, bz), bz]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.1, 6]} />
              {steel}
            </mesh>
            <mesh position={[0, 0.115, 0]}>
              <octahedronGeometry args={[0.02, 0]} />
              <meshBasicMaterial
                color={projectId === "track-fields" ? "#FFFFFF" : "#38BDF8"}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[gpsBoundary, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#38BDF8"
            transparent
            opacity={projectId === "track-fields" ? 1 : 0.5}
          />
        </lineSegments>

        {/* Active Project Target Lock Reticle + Floating Waypoint Beacon */}
        <group ref={targetReticleRef} position={[-0.52, 0.2, -0.42]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.235, 0.25, 6]} />
            <meshBasicMaterial
              color={themeColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.95}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.306, 48, 1, 0, Math.PI * 1.25]} />
            <meshBasicMaterial
              color={themeColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.55}
            />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.002, 0.008, 0.28, 6]} />
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={waypointDiamondRef} position={[0, 0.3, 0]}>
            <octahedronGeometry args={[0.038, 0]} />
            <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          TIER 3: TELEMETRY COMPASS RING SURROUNDING THE DIORAMA
      ===================================================================== */}
      <group ref={compassRingRef} position={[0, -0.15, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.95, 0.0045, 6, lite ? 72 : 120]} />
          <meshBasicMaterial color={themeColor} transparent opacity={0.4} />
        </mesh>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[compassTicks, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#7C8AA0" transparent opacity={0.55} />
        </lineSegments>
      </group>
    </group>
  );
}
