"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface StrutSegment {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  radius: number;
}

const UP = new THREE.Vector3(0, 1, 0);

function makeStrut(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number
): StrutSegment {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const position = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    UP,
    dir.clone().normalize()
  );
  return { position, quaternion, length, radius };
}

/**
 * Generates mathematically exact node-to-node structural steel members and
 * lattice bracing for a 6-tier 220kV double-circuit transmission tower.
 */
function buildLatticeTowerGeometry() {
  const tiers = [
    { y: -1.22, w: 0.52 }, // Tier 0: Base on concrete footings
    { y: -0.62, w: 0.38 }, // Tier 1: Lower body
    { y: -0.05, w: 0.26 }, // Tier 2: Waist / bend line
    { y: 0.48, w: 0.22 },  // Tier 3: Bottom crossarm level
    { y: 0.96, w: 0.19 },  // Tier 4: Middle crossarm level
    { y: 1.42, w: 0.16 },  // Tier 5: Top crossarm level
    { y: 1.84, w: 0.02 },  // Tier 6: Pyramidal earth-wire peak
  ];

  const crossarms = [
    {
      tierIdx: 3,
      y: 0.48,
      spanHalf: 0.96,
      baseW: 0.22,
      height: 0.16,
      phase: "B",
      color: "#38BDF8",
    },
    {
      tierIdx: 4,
      y: 0.96,
      spanHalf: 1.12,
      baseW: 0.19,
      height: 0.15,
      phase: "Y",
      color: "#FFB74D",
    },
    {
      tierIdx: 5,
      y: 1.42,
      spanHalf: 0.86,
      baseW: 0.16,
      height: 0.14,
      phase: "R",
      color: "#FE6E00",
    },
  ];

  const mainStruts: StrutSegment[] = [];
  const braceLines: number[] = [];

  const pushLine = (a: THREE.Vector3, b: THREE.Vector3) => {
    braceLines.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  const getCorners = (y: number, w: number): THREE.Vector3[] => [
    new THREE.Vector3(-w, y, -w),
    new THREE.Vector3(w, y, -w),
    new THREE.Vector3(w, y, w),
    new THREE.Vector3(-w, y, w),
  ];

  for (let t = 0; t < tiers.length - 1; t++) {
    const bot = getCorners(tiers[t].y, tiers[t].w);
    const top = getCorners(tiers[t + 1].y, tiers[t + 1].w);
    const legRadius = t < 2 ? 0.022 : t < 5 ? 0.018 : 0.014;

    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      mainStruts.push(makeStrut(bot[c], top[c], legRadius));
      if (t < tiers.length - 2) {
        mainStruts.push(makeStrut(top[c], top[next], 0.011));
      }

      const midL = new THREE.Vector3().lerpVectors(bot[c], top[c], 0.5);
      const midR = new THREE.Vector3().lerpVectors(bot[next], top[next], 0.5);

      pushLine(bot[c], midR);
      pushLine(bot[next], midL);
      pushLine(midL, midR);

      pushLine(midL, top[next]);
      pushLine(midR, top[c]);
      pushLine(top[c], top[next]);
    }

    if (t < tiers.length - 2) {
      pushLine(top[0], top[2]);
      pushLine(top[1], top[3]);
    }
  }

  for (const arm of crossarms) {
    const w = arm.baseW;
    const y0 = arm.y;
    const yTop = arm.y + arm.height;
    const zHalf = w * 0.82;

    for (const dir of [-1, 1]) {
      const tipX = dir * arm.spanHalf;
      const rootX = dir * w;

      const rootFL = new THREE.Vector3(rootX, y0, zHalf);
      const rootBL = new THREE.Vector3(rootX, y0, -zHalf);
      const rootTopF = new THREE.Vector3(rootX * 0.9, yTop, zHalf * 0.75);
      const rootTopB = new THREE.Vector3(rootX * 0.9, yTop, -zHalf * 0.75);

      const tipF = new THREE.Vector3(tipX, y0, 0.035);
      const tipB = new THREE.Vector3(tipX, y0, -0.035);
      const tipTop = new THREE.Vector3(tipX * 0.96, y0 + 0.035, 0);

      mainStruts.push(makeStrut(rootFL, tipF, 0.011));
      mainStruts.push(makeStrut(rootBL, tipB, 0.011));
      mainStruts.push(makeStrut(rootTopF, tipTop, 0.008));
      mainStruts.push(makeStrut(rootTopB, tipTop, 0.008));

      const segs = 4;
      for (let s = 0; s < segs; s++) {
        const u0 = s / segs;
        const u1 = (s + 1) / segs;
        const bF0 = new THREE.Vector3().lerpVectors(rootFL, tipF, u0);
        const bF1 = new THREE.Vector3().lerpVectors(rootFL, tipF, u1);
        const bB0 = new THREE.Vector3().lerpVectors(rootBL, tipB, u0);
        const bB1 = new THREE.Vector3().lerpVectors(rootBL, tipB, u1);
        const tF0 = new THREE.Vector3().lerpVectors(rootTopF, tipTop, u0);
        const tF1 = new THREE.Vector3().lerpVectors(rootTopF, tipTop, u1);
        const tB0 = new THREE.Vector3().lerpVectors(rootTopB, tipTop, u0);
        const tB1 = new THREE.Vector3().lerpVectors(rootTopB, tipTop, u1);

        pushLine(bF0, tF1);
        pushLine(tF0, bF1);
        pushLine(bB0, tB1);
        pushLine(tB0, bB1);
        pushLine(bF0, bB1);
      }
    }
  }

  return {
    mainStruts,
    bracePositions: new Float32Array(braceLines),
    crossarms,
    footingCorners: [
      [-0.52, -0.52],
      [0.52, -0.52],
      [0.52, 0.52],
      [-0.52, 0.52],
    ] as [number, number][],
  };
}

const PACKET_POS = new THREE.Vector3();

export default function GridNetworkAsset({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number];
  scale?: number;
}) {
  const rootRef = useRef<THREE.Group>(null!);
  const radarDishRef = useRef<THREE.Group>(null!);
  const beaconRef = useRef<THREE.Mesh>(null!);
  const yardRingRef = useRef<THREE.Group>(null!);
  const pulseRefs = useRef<THREE.Mesh[]>([]);
  const pulseTrailRefs = useRef<THREE.Mesh[]>([]);
  const coronaArcRefs = useRef<THREE.Mesh[]>([]);

  const towerData = useMemo(() => buildLatticeTowerGeometry(), []);

  const yardGridLines = useMemo(() => {
    const pts: number[] = [];
    const halfW = 1.26;
    const halfD = 1.06;
    for (let i = -4; i <= 4; i++) {
      const x = (i / 4) * halfW;
      pts.push(x, 0, -halfD, x, 0, halfD);
    }
    for (let j = -4; j <= 4; j++) {
      const z = (j / 4) * halfD;
      pts.push(-halfW, 0, z, halfW, 0, z);
    }
    return new Float32Array(pts);
  }, []);

  const { conductorLines, insulatorClusters } = useMemo(() => {
    const clusters: {
      x: number;
      y: number;
      color: string;
      phase: string;
      side: number;
    }[] = [];

    const curves: {
      id: string;
      curve: THREE.QuadraticBezierCurve3;
      color: string;
      speed: number;
      geometry: THREE.TubeGeometry;
    }[] = [];

    towerData.crossarms.forEach((arm, idx) => {
      for (const side of [-1, 1]) {
        const x = side * arm.spanHalf;
        const y = arm.y;
        clusters.push({ x, y, color: arm.color, phase: arm.phase, side });

        const clampPos = new THREE.Vector3(x, y - 0.22, 0);

        // Span A: Catenary outgoing transmission line (-Z corridor)
        const farEnd = new THREE.Vector3(x * 1.08, y - 0.12, -2.1);
        const farMid = clampPos.clone().add(farEnd).multiplyScalar(0.5);
        farMid.y -= 0.24;
        const farCurve = new THREE.QuadraticBezierCurve3(
          clampPos,
          farMid,
          farEnd
        );
        curves.push({
          id: `span-rear-${idx}-${side}`,
          curve: farCurve,
          color: arm.color,
          speed: 0.48 + idx * 0.07,
          geometry: new THREE.TubeGeometry(farCurve, 20, 0.0065, 6, false),
        });

        if (side === -1) {
          // Left Circuit (-X) drops down into the 3 HV Transformer Bushings
          const bushingX = -0.82 + (idx - 1) * 0.14;
          const bushingPos = new THREE.Vector3(bushingX, -0.52, 0.42);
          const dropMid = new THREE.Vector3(
            (x + bushingX) * 0.5 - 0.08,
            (clampPos.y + bushingPos.y) * 0.5 - 0.1,
            0.24
          );
          const dropCurve = new THREE.QuadraticBezierCurve3(
            clampPos,
            dropMid,
            bushingPos
          );
          curves.push({
            id: `drop-xfmr-${idx}`,
            curve: dropCurve,
            color: arm.color,
            speed: 0.62 + idx * 0.08,
            geometry: new THREE.TubeGeometry(dropCurve, 20, 0.0065, 6, false),
          });
        } else {
          // Right Circuit (+X) continues forward along the transmission corridor (+Z)
          const nearEnd = new THREE.Vector3(x * 1.08, y - 0.12, 2.0);
          const nearMid = clampPos.clone().add(nearEnd).multiplyScalar(0.5);
          nearMid.y -= 0.22;
          const nearCurve = new THREE.QuadraticBezierCurve3(
            clampPos,
            nearMid,
            nearEnd
          );
          curves.push({
            id: `span-front-${idx}`,
            curve: nearCurve,
            color: arm.color,
            speed: 0.52 + idx * 0.06,
            geometry: new THREE.TubeGeometry(nearCurve, 20, 0.0065, 6, false),
          });
        }
      }
    });

    // Overhead OPGW Optical Ground Wire from the tower peak (y = 1.84)
    const peakStart = new THREE.Vector3(0, 1.84, 0);
    const peakEndRear = new THREE.Vector3(0, 1.72, -2.1);
    const peakMidRear = new THREE.Vector3(0, 1.62, -1.05);
    const opgwCurve = new THREE.QuadraticBezierCurve3(
      peakStart,
      peakMidRear,
      peakEndRear
    );
    curves.push({
      id: "opgw-shield",
      curve: opgwCurve,
      color: "#E2E8F0",
      speed: 0.85,
      geometry: new THREE.TubeGeometry(opgwCurve, 18, 0.0045, 5, false),
    });

    return { conductorLines: curves, insulatorClusters: clusters };
  }, [towerData]);

  useEffect(
    () => () => {
      conductorLines.forEach((c) => c.geometry.dispose());
    },
    [conductorLines]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (rootRef.current) {
      const targetRotY =
        -0.42 + Math.sin(t * 0.28) * 0.14 + state.pointer.x * 0.22;
      const targetRotX = 0.22 - state.pointer.y * 0.1;
      rootRef.current.rotation.y = THREE.MathUtils.damp(
        rootRef.current.rotation.y,
        targetRotY,
        4,
        delta
      );
      rootRef.current.rotation.x = THREE.MathUtils.damp(
        rootRef.current.rotation.x,
        targetRotX,
        4,
        delta
      );
    }

    if (radarDishRef.current) {
      radarDishRef.current.rotation.y = t * 1.6;
    }

    if (yardRingRef.current) {
      yardRingRef.current.rotation.z = -t * 0.12;
    }

    if (beaconRef.current) {
      const flash = Math.sin(t * 6.5) > 0.25 ? 6.0 : 0.8;
      (
        beaconRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = flash;
    }

    // Flickering high-voltage corona discharge along insulator strings
    coronaArcRefs.current.forEach((arc, i) => {
      if (!arc) return;
      const p = t * 8.5 + i * 2.1;
      const active = Math.sin(p) * Math.cos(p * 2.3) > 0.45;
      arc.visible = active;
      arc.rotation.y = p;
    });

    conductorLines.forEach((line, li) => {
      const u = (t * line.speed + li * 0.19) % 1;
      const pkt = pulseRefs.current[li];
      if (pkt) {
        line.curve.getPoint(u, PACKET_POS);
        pkt.position.copy(PACKET_POS);
      }
      const trail = pulseTrailRefs.current[li];
      if (trail) {
        line.curve.getPoint((u - 0.05 + 1) % 1, PACKET_POS);
        trail.position.copy(PACKET_POS);
      }
    });
  });

  return (
    <group
      ref={rootRef}
      position={position}
      scale={scale}
      rotation={[0.22, -0.42, 0]}
    >
      <pointLight
        position={[-1.2, 0.8, 1.6]}
        intensity={4.2}
        color="#FE6E00"
        distance={9}
      />

      {/* =====================================================================
          1. ARCHITECTURAL SUBSTATION PLINTH & EARTHING GRID DECK
      ===================================================================== */}
      <group position={[0, -1.32, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[2.76, 0.16, 2.36]} />
          <meshStandardMaterial
            color="#10151E"
            metalness={0.75}
            roughness={0.35}
          />
        </mesh>

        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[2.58, 0.04, 2.18]} />
          <meshStandardMaterial
            color="#18202C"
            metalness={0.55}
            roughness={0.5}
          />
        </mesh>

        {/* Luminous Perimeter Safety Curbing */}
        <mesh position={[0, 0.035, 1.09]}>
          <boxGeometry args={[2.58, 0.016, 0.02]} />
          <meshBasicMaterial color="#FE6E00" />
        </mesh>
        <mesh position={[0, 0.035, -1.09]}>
          <boxGeometry args={[2.58, 0.016, 0.02]} />
          <meshBasicMaterial color="#FE6E00" />
        </mesh>
        <mesh position={[-1.29, 0.035, 0]}>
          <boxGeometry args={[0.02, 0.016, 2.18]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.75} />
        </mesh>
        <mesh position={[1.29, 0.035, 0]}>
          <boxGeometry args={[0.02, 0.016, 2.18]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.75} />
        </mesh>

        {/* Inlaid Copper/Cyan Earthing Grid Mesh */}
        <group position={[0, 0.033, 0]}>
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[yardGridLines, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineSegments>
        </group>

        {/* 4 Concrete Tower Leg Pedestals & Anchor Plates */}
        {towerData.footingCorners.map(([fx, fz], i) => (
          <group key={`footing-${i}`} position={[fx, 0.07, fz]}>
            <mesh>
              <boxGeometry args={[0.18, 0.1, 0.18]} />
              <meshStandardMaterial
                color="#2A3444"
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
            <mesh position={[0, 0.055, 0]}>
              <boxGeometry args={[0.12, 0.02, 0.12]} />
              <meshStandardMaterial
                color="#FE6E00"
                emissive="#FE6E00"
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        ))}

        {/* 4 Corner Yard Telemetry Bollards */}
        {[
          [-1.2, -1.0],
          [1.2, -1.0],
          [-1.2, 1.0],
          [1.2, 1.0],
        ].map(([bx, bz], i) => (
          <group key={`bollard-${i}`} position={[bx, 0.08, bz]}>
            <mesh>
              <cylinderGeometry args={[0.018, 0.022, 0.12, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color={i % 2 === 0 ? "#FE6E00" : "#38BDF8"} />
            </mesh>
          </group>
        ))}

        {/* Outer Substation Survey Azimuth Halo Ring */}
        <group ref={yardRingRef} position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <torusGeometry args={[1.92, 0.005, 6, 64]} />
            <meshBasicMaterial color="#FE6E00" transparent opacity={0.35} />
          </mesh>
          <mesh>
            <torusGeometry args={[2.02, 0.003, 6, 64]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.22} />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          2. LEFT BAY: 220/33kV STEP-DOWN POWER TRANSFORMER UNIT
      ===================================================================== */}
      <group position={[-0.82, -1.02, 0.42]}>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[0.66, 0.06, 0.52]} />
          <meshStandardMaterial color="#252F3F" metalness={0.6} roughness={0.4} />
        </mesh>

        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.48, 0.42, 0.34]} />
          <meshStandardMaterial
            color="#2B3648"
            metalness={0.78}
            roughness={0.28}
          />
        </mesh>

        {[-0.18, -0.11, -0.04, 0.04, 0.11, 0.18].map((fx, fi) => (
          <mesh key={`fin-${fi}`} position={[fx, 0, 0.19]}>
            <boxGeometry args={[0.022, 0.34, 0.06]} />
            <meshStandardMaterial
              color="#3B4960"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
        ))}

        <mesh position={[-0.08, 0.3, -0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 0.32, 14]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.85}
            roughness={0.22}
          />
        </mesh>
        <mesh position={[0.085, 0.3, -0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.057, 0.057, 0.015, 14]} />
          <meshBasicMaterial color="#FE6E00" />
        </mesh>

        {[
          { x: -0.14, color: "#38BDF8" },
          { x: 0, color: "#FFB74D" },
          { x: 0.14, color: "#FE6E00" },
        ].map((bush, bi) => (
          <group key={`bush-${bi}`} position={[bush.x, 0.22, 0.04]}>
            {[0, 1, 2, 3, 4].map((d) => (
              <mesh key={d} position={[0, 0.04 + d * 0.042, 0]}>
                <cylinderGeometry args={[0.032, 0.024, 0.022, 10]} />
                <meshStandardMaterial
                  color="#E2E8F0"
                  metalness={0.4}
                  roughness={0.3}
                />
              </mesh>
            ))}
            <mesh position={[0, 0.28, 0]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshBasicMaterial color={bush.color} />
            </mesh>
          </group>
        ))}

        <mesh position={[0.245, 0.04, 0]}>
          <boxGeometry args={[0.015, 0.16, 0.18]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      </group>

      {/* =====================================================================
          2B. ELEVATED 3-PHASE TUBULAR BUSBAR BRIDGE & ISOLATOR SWITCHBAY
      ===================================================================== */}
      <group position={[0, -0.88, 0.68]}>
        {/* Center Isolator Support Portal Post */}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.14, 0.36, 0.14]} />
          <meshStandardMaterial color="#252F3F" metalness={0.7} roughness={0.35} />
        </mesh>
        {/* 3 Post Insulators & Tubular Busbars linking Transformer to SCADA Kiosk */}
        {[
          { zOff: -0.05, yOff: 0.04, color: "#FE6E00" },
          { zOff: 0, yOff: 0.0, color: "#FFB74D" },
          { zOff: 0.05, yOff: -0.04, color: "#38BDF8" },
        ].map((bus, bi) => (
          <group key={`busbar-${bi}`} position={[0, bus.yOff, bus.zOff]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.0055, 0.0055, 1.15, 8]} />
              <meshBasicMaterial color={bus.color} />
            </mesh>
            <mesh position={[0, -0.04, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.08, 8]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.4} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>

      {/* =====================================================================
          2C. REAR BAY: 3-POLE SF6 CIRCUIT BREAKER & CAPACITOR BANK
      ===================================================================== */}
      <group position={[-0.84, -1.1, -0.52]}>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.52, 0.06, 0.38]} />
          <meshStandardMaterial color="#252F3F" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.42, 0.22, 0.24]} />
          <meshStandardMaterial color="#2B3648" metalness={0.75} roughness={0.3} />
        </mesh>
        {[-0.12, 0, 0.12].map((px, pi) => (
          <group key={`sf6-${pi}`} position={[px, 0.22, 0]}>
            <mesh>
              <cylinderGeometry args={[0.026, 0.026, 0.22, 10]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshBasicMaterial
                color={pi === 0 ? "#FE6E00" : pi === 1 ? "#FFB74D" : "#38BDF8"}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* =====================================================================
          3. RIGHT BAY: SCADA TELEMETRY & GIS CONTROL KIOSK
      ===================================================================== */}
      <group position={[0.82, -1.06, 0.44]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.54, 0.36, 0.38]} />
          <meshStandardMaterial
            color="#222B3A"
            metalness={0.72}
            roughness={0.32}
          />
        </mesh>

        <mesh position={[0, 0.195, 0.02]}>
          <boxGeometry args={[0.6, 0.03, 0.44]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.85}
            roughness={0.24}
          />
        </mesh>
        <mesh position={[0, 0.195, 0.242]}>
          <boxGeometry args={[0.6, 0.022, 0.01]} />
          <meshBasicMaterial color="#FE6E00" />
        </mesh>

        {/* Illuminated SCADA Mimic Diagram Display Window */}
        <mesh position={[-0.06, 0.02, 0.192]}>
          <boxGeometry args={[0.3, 0.16, 0.01]} />
          <meshStandardMaterial
            color="#0B1528"
            emissive="#0284C7"
            emissiveIntensity={1.2}
          />
        </mesh>
        <mesh position={[-0.06, 0.04, 0.198]}>
          <boxGeometry args={[0.24, 0.018, 0.006]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>
        <mesh position={[-0.06, -0.01, 0.198]}>
          <boxGeometry args={[0.2, 0.018, 0.006]} />
          <meshBasicMaterial color="#FE6E00" />
        </mesh>

        <mesh position={[0.17, -0.02, 0.192]}>
          <boxGeometry args={[0.1, 0.26, 0.01]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.17, 0.14, 0.196]}>
          <boxGeometry args={[0.04, 0.02, 0.01]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>

        {/* Roof-Mounted Rotating SCADA Telemetry Dish & Halo */}
        <group ref={radarDishRef} position={[0, 0.28, 0]}>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.02, 0.025, 0.08, 8]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh rotation={[0.35, 0, 0]}>
            <coneGeometry args={[0.08, 0.05, 14, 1, true]} />
            <meshStandardMaterial
              color="#E2E8F0"
              metalness={0.88}
              roughness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.02, 0.03]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>
          <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.1, 0.115, 16]} />
            <meshBasicMaterial
              color="#38BDF8"
              side={THREE.DoubleSide}
              transparent
              opacity={0.55}
            />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          4. 220kV DOUBLE-CIRCUIT STEEL LATTICE TRANSMISSION TOWER
      ===================================================================== */}
      {towerData.mainStruts.map((s, idx) => (
        <mesh key={`strut-${idx}`} position={s.position} quaternion={s.quaternion}>
          <cylinderGeometry args={[s.radius, s.radius, s.length, 6]} />
          <meshStandardMaterial
            color="#94A3B8"
            metalness={0.82}
            roughness={0.28}
          />
        </mesh>
      ))}

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[towerData.bracePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FFB74D" transparent opacity={0.82} />
      </lineSegments>

      {/* =====================================================================
          5. SIX SUSPENSION INSULATOR STRINGS, CORONA RINGS & ARCS
      ===================================================================== */}
      {insulatorClusters.map((ins, i) => (
        <group key={`ins-${i}`} position={[ins.x, ins.y, 0]}>
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.22, 6]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.2} />
          </mesh>

          {Array.from({ length: 7 }, (_, d) => (
            <mesh key={d} position={[0, -0.02 - d * 0.028, 0]}>
              <cylinderGeometry args={[0.038, 0.028, 0.012, 12]} />
              <meshStandardMaterial
                color="#E0F2FE"
                emissive={ins.color}
                emissiveIntensity={0.45}
                metalness={0.35}
                roughness={0.25}
              />
            </mesh>
          ))}

          {/* Corona Field-Grading Ring & Conductor Clamp */}
          <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.048, 0.006, 6, 16]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={ins.color} />
          </mesh>

          {/* Animated High-Voltage Corona Discharge Filament */}
          <mesh
            ref={(el) => {
              coronaArcRefs.current[i] = el as THREE.Mesh;
            }}
            position={[0.02, -0.11, 0]}
            rotation={[0, 0, 0.18]}
          >
            <cylinderGeometry args={[0.003, 0.003, 0.2, 4]} />
            <meshBasicMaterial
              color="#FFFFFF"
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          6. THREE-PHASE CATENARY CONDUCTORS, DROP-LEADS & ENERGY PACKETS
      ===================================================================== */}
      {conductorLines.map((line, li) => (
        <React.Fragment key={line.id}>
          <mesh geometry={line.geometry}>
            <meshBasicMaterial
              color={line.color}
              transparent
              opacity={0.78}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              pulseTrailRefs.current[li] = el as THREE.Mesh;
            }}
          >
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial
              color={line.color}
              transparent
              opacity={0.48}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              pulseRefs.current[li] = el as THREE.Mesh;
            }}
          >
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </React.Fragment>
      ))}

      {/* =====================================================================
          7. TOWER PEAK ARRESTOR SPIRE, AVIATION MARKERS & FAA STROBE
      ===================================================================== */}
      {[0.45, 0.95, 1.45].map((zDist, idx) => (
        <mesh
          key={`av-ball-${idx}`}
          position={[0, 1.77 - idx * 0.04, -zDist]}
        >
          <sphereGeometry args={[0.036, 12, 12]} />
          <meshStandardMaterial
            color={idx % 2 === 0 ? "#FE6E00" : "#F8FAFC"}
            emissive={idx % 2 === 0 ? "#FE6E00" : "#38BDF8"}
            emissiveIntensity={0.45}
            roughness={0.3}
            metalness={0.3}
          />
        </mesh>
      ))}

      <group position={[0, 1.84, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.006, 0.012, 0.28, 8]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.09, 0.006, 6, 20]} />
          <meshBasicMaterial color="#FE6E00" />
        </mesh>
        <mesh ref={beaconRef} position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.036, 12, 12]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FE6E00"
            emissiveIntensity={4.5}
          />
        </mesh>
      </group>
    </group>
  );
}
