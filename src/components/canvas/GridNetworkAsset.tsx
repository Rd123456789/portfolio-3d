"use client";

import React, { useRef, useMemo, useEffect, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  advanceClock,
  createFlowLineMaterial,
  type TimeUniform,
} from "@/lib/shaders";

/** One straight steel member of the tower, node to node. */
interface Member {
  a: THREE.Vector3;
  b: THREE.Vector3;
  radius: number;
}

const UP = new THREE.Vector3(0, 1, 0);

const PHASES = [
  { name: "B", color: "#38BDF8" },
  { name: "Y", color: "#FFB74D" },
  { name: "R", color: "#FE6E00" },
];

/**
 * Node-to-node steel members for a 220kV double-circuit lattice tower: a
 * splayed base, a near-parallel cage carrying three cross-arms per side, and
 * a pyramidal earth-wire peak. Every member is real geometry, so the tower
 * is drawn as one instanced batch of angle sections rather than hairlines.
 */
function buildLatticeTower() {
  const tiers = [
    { y: -1.22, w: 0.52 }, // Tier 0: base on concrete footings
    { y: -0.62, w: 0.38 }, // Tier 1: lower body
    { y: -0.05, w: 0.26 }, // Tier 2: waist / bend line
    { y: 0.48, w: 0.22 }, // Tier 3: bottom cross-arm level
    { y: 0.96, w: 0.19 }, // Tier 4: middle cross-arm level
    { y: 1.42, w: 0.16 }, // Tier 5: top cross-arm level
    { y: 1.84, w: 0.02 }, // Tier 6: earth-wire peak
  ];

  const crossarms = [
    { y: 0.48, spanHalf: 0.96, baseW: 0.22, height: 0.16, ...PHASES[0] },
    { y: 0.96, spanHalf: 1.12, baseW: 0.19, height: 0.15, ...PHASES[1] },
    { y: 1.42, spanHalf: 0.86, baseW: 0.16, height: 0.14, ...PHASES[2] },
  ];

  const members: Member[] = [];
  const add = (a: THREE.Vector3, b: THREE.Vector3, radius: number) =>
    members.push({ a, b, radius });

  const corners = (y: number, w: number): THREE.Vector3[] => [
    new THREE.Vector3(-w, y, -w),
    new THREE.Vector3(w, y, -w),
    new THREE.Vector3(w, y, w),
    new THREE.Vector3(-w, y, w),
  ];
  const mid = (a: THREE.Vector3, b: THREE.Vector3) =>
    new THREE.Vector3().lerpVectors(a, b, 0.5);

  const LEG = [0.02, 0.019, 0.017, 0.015, 0.014, 0.011];
  const BRACE = 0.0062;
  const GIRT = 0.0085;

  for (let t = 0; t < tiers.length - 1; t++) {
    const bot = corners(tiers[t].y, tiers[t].w);
    const top = corners(tiers[t + 1].y, tiers[t + 1].w);
    const isPeak = t === tiers.length - 2;

    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      add(bot[c], top[c], LEG[t]);

      if (isPeak) {
        // A single girt ties the converging peak legs together
        add(mid(bot[c], top[c]), mid(bot[next], top[next]), BRACE);
        continue;
      }

      add(top[c], top[next], GIRT);

      if (t < 2) {
        // Tall body panels: K-braced through a mid-height girt
        const midL = mid(bot[c], top[c]);
        const midR = mid(bot[next], top[next]);
        add(bot[c], midR, BRACE);
        add(bot[next], midL, BRACE);
        add(midL, midR, BRACE);
        add(midL, top[next], BRACE);
        add(midR, top[c], BRACE);
      } else {
        // Cage panels: a single cross
        add(bot[c], top[next], BRACE);
        add(bot[next], top[c], BRACE);
      }
    }

    // Plan bracing keeps each girt frame square
    if (!isPeak) {
      add(top[0], top[2], BRACE * 0.85);
      if (t >= 2) add(top[1], top[3], BRACE * 0.85);
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

      const rootF = new THREE.Vector3(rootX, y0, zHalf);
      const rootB = new THREE.Vector3(rootX, y0, -zHalf);
      const rootTopF = new THREE.Vector3(rootX * 0.9, yTop, zHalf * 0.75);
      const rootTopB = new THREE.Vector3(rootX * 0.9, yTop, -zHalf * 0.75);
      const tipF = new THREE.Vector3(tipX, y0, 0.035);
      const tipB = new THREE.Vector3(tipX, y0, -0.035);
      const tipTop = new THREE.Vector3(tipX * 0.97, y0 + 0.03, 0);

      // Tension chords above, compression chords below
      add(rootF, tipF, 0.0095);
      add(rootB, tipB, 0.0095);
      add(rootTopF, tipTop, 0.0075);
      add(rootTopB, tipTop, 0.0075);
      add(tipF, tipB, 0.0075);

      const panels = 4;
      for (let s = 0; s < panels; s++) {
        const u0 = s / panels;
        const u1 = (s + 1) / panels;
        const lerp = (p: THREE.Vector3, q: THREE.Vector3, u: number) =>
          new THREE.Vector3().lerpVectors(p, q, u);

        // Zig-zag lacing on both faces and across the bottom plane
        add(lerp(rootF, tipF, u0), lerp(rootTopF, tipTop, u1), 0.0046);
        add(lerp(rootTopF, tipTop, u0), lerp(rootF, tipF, u1), 0.0046);
        add(lerp(rootB, tipB, u0), lerp(rootTopB, tipTop, u1), 0.0046);
        add(lerp(rootTopB, tipTop, u0), lerp(rootB, tipB, u1), 0.0046);
        add(lerp(rootF, tipF, u0), lerp(rootB, tipB, u1), 0.0046);
      }
    }
  }

  return {
    members,
    crossarms,
    footingCorners: corners(0, tiers[0].w).map((v) => [v.x, v.z]) as [
      number,
      number
    ][],
  };
}

const INSULATOR_DISCS = 7;
const INSULATOR_PITCH = 0.028;

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
  const steelRef = useRef<THREE.InstancedMesh>(null!);
  const discRef = useRef<THREE.InstancedMesh>(null!);

  const tower = useMemo(() => buildLatticeTower(), []);
  const clock = useMemo<TimeUniform>(() => ({ value: 0 }), []);

  const yardGridLines = useMemo(() => {
    const pts: number[] = [];
    const halfW = 1.26;
    const halfD = 1.06;
    for (let i = -6; i <= 6; i++) {
      const x = (i / 6) * halfW;
      pts.push(x, 0, -halfD, x, 0, halfD);
    }
    for (let j = -5; j <= 5; j++) {
      const z = (j / 5) * halfD;
      pts.push(-halfW, 0, z, halfW, 0, z);
    }
    return new Float32Array(pts);
  }, []);

  const { conductors, insulators, shieldWire } = useMemo(() => {
    const strings: { x: number; y: number; color: string }[] = [];
    const lines: {
      id: string;
      geometry: THREE.TubeGeometry;
      material: THREE.ShaderMaterial;
    }[] = [];

    const energise = (
      id: string,
      curve: THREE.Curve<THREE.Vector3>,
      color: string,
      speed: number,
      fadeEnd: number
    ) =>
      lines.push({
        id,
        geometry: new THREE.TubeGeometry(curve, 32, 0.0052, 6, false),
        material: createFlowLineMaterial({
          color,
          time: clock,
          speed,
          pulses: 2,
          offset: lines.length * 0.31,
          base: 0.9,
          fadeStart: 0.01,
          fadeEnd,
        }),
      });

    tower.crossarms.forEach((arm, idx) => {
      for (const side of [-1, 1]) {
        const x = side * arm.spanHalf;
        strings.push({ x, y: arm.y, color: arm.color });

        const clamp = new THREE.Vector3(x, arm.y - 0.225, 0);

        // Outgoing span down the corridor (-Z), sagging and fading into distance
        const farEnd = new THREE.Vector3(x * 1.06, arm.y - 0.1, -2.3);
        const farSag = clamp.clone().add(farEnd).multiplyScalar(0.5);
        farSag.y -= 0.3;
        energise(
          `span-rear-${idx}-${side}`,
          new THREE.QuadraticBezierCurve3(clamp, farSag, farEnd),
          arm.color,
          0.34 + idx * 0.05,
          0.5
        );

        if (side === -1) {
          // Left circuit: jumpers drop into the transformer's HV bushings
          const bushing = new THREE.Vector3(-0.82 + (idx - 1) * 0.14, -0.5, 0.46);
          const drop = new THREE.CatmullRomCurve3(
            [
              clamp,
              new THREE.Vector3(x + 0.02, (clamp.y + bushing.y) * 0.5 + 0.06, 0.13),
              new THREE.Vector3(bushing.x - 0.03, bushing.y + 0.2, 0.4),
              bushing,
            ],
            false,
            "centripetal"
          );
          energise(`drop-xfmr-${idx}`, drop, arm.color, 0.5 + idx * 0.06, 0.01);
        } else {
          // Right circuit: continues up the corridor toward the viewer (+Z)
          const nearEnd = new THREE.Vector3(x * 1.06, arm.y - 0.1, 2.2);
          const nearSag = clamp.clone().add(nearEnd).multiplyScalar(0.5);
          nearSag.y -= 0.28;
          energise(
            `span-front-${idx}`,
            new THREE.QuadraticBezierCurve3(clamp, nearSag, nearEnd),
            arm.color,
            0.38 + idx * 0.05,
            0.5
          );
        }
      }
    });

    // OPGW earth wire off the peak: passive, so plain steel rather than a flow line
    const shield = new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 1.84, 0),
        new THREE.Vector3(0, 1.6, -1.15),
        new THREE.Vector3(0, 1.72, -2.3)
      ),
      24,
      0.0036,
      5,
      false
    );

    return { conductors: lines, insulators: strings, shieldWire: shield };
  }, [tower, clock]);

  // Lay every steel member and insulator disc into its instanced batch
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scaleVec = new THREE.Vector3();
    const dir = new THREE.Vector3();

    const steel = steelRef.current;
    tower.members.forEach((member, i) => {
      dir.subVectors(member.b, member.a);
      const length = dir.length();
      quaternion.setFromUnitVectors(UP, dir.normalize());
      position.addVectors(member.a, member.b).multiplyScalar(0.5);
      scaleVec.set(member.radius, length, member.radius);
      steel.setMatrixAt(i, matrix.compose(position, quaternion, scaleVec));
    });
    steel.instanceMatrix.needsUpdate = true;

    const discs = discRef.current;
    const tint = new THREE.Color();
    const porcelain = new THREE.Color("#EEF3F8");
    quaternion.identity();
    scaleVec.set(1, 1, 1);
    insulators.forEach((string, s) => {
      for (let d = 0; d < INSULATOR_DISCS; d++) {
        const i = s * INSULATOR_DISCS + d;
        position.set(string.x, string.y - 0.024 - d * INSULATOR_PITCH, 0);
        discs.setMatrixAt(i, matrix.compose(position, quaternion, scaleVec));
        discs.setColorAt(i, tint.set(string.color).lerp(porcelain, 0.78));
      }
    });
    discs.instanceMatrix.needsUpdate = true;
    if (discs.instanceColor) discs.instanceColor.needsUpdate = true;
  }, [tower, insulators]);

  useEffect(
    () => () => {
      conductors.forEach((c) => {
        c.geometry.dispose();
        c.material.dispose();
      });
      shieldWire.dispose();
    },
    [conductors, shieldWire]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    advanceClock(clock, t);

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

    if (radarDishRef.current) radarDishRef.current.rotation.y = t * 1.2;
    if (yardRingRef.current) yardRingRef.current.rotation.z = -t * 0.12;

    // Aviation obstruction light: slow red flash, as on a real tower
    if (beaconRef.current) {
      const flash = Math.pow(Math.max(0, Math.sin(t * 2.6)), 6);
      (
        beaconRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = 0.5 + flash * 9;
    }
  });

  return (
    <group
      ref={rootRef}
      position={position}
      scale={scale}
      rotation={[0.22, -0.42, 0]}
    >
      {/* Warm sodium-style yard light on the equipment bays */}
      <pointLight
        position={[-1.1, -0.2, 1.5]}
        intensity={0.7}
        color="#FF8A3D"
        distance={6}
      />

      {/* =====================================================================
          1. SUBSTATION PLINTH, GRAVEL YARD & EARTHING GRID
      ===================================================================== */}
      <group position={[0, -1.32, 0]}>
        <RoundedBox
          args={[2.76, 0.16, 2.36]}
          radius={0.028}
          smoothness={3}
          position={[0, -0.08, 0]}
        >
          <meshStandardMaterial color="#1A202A" metalness={0.9} roughness={0.34} />
        </RoundedBox>

        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[2.58, 0.04, 2.18]} />
          <meshStandardMaterial color="#1C232D" metalness={0.05} roughness={0.92} />
        </mesh>

        {/* Hairline perimeter curbing */}
        {[-1, 1].map((side) => (
          <React.Fragment key={`curb-${side}`}>
            <mesh position={[0, 0.033, side * 1.09]}>
              <boxGeometry args={[2.58, 0.008, 0.011]} />
              <meshBasicMaterial color="#FE6E00" toneMapped={false} />
            </mesh>
            <mesh position={[side * 1.29, 0.033, 0]}>
              <boxGeometry args={[0.011, 0.008, 2.18]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={0.7} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Buried copper earthing grid showing through the yard */}
        <lineSegments position={[0, 0.032, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[yardGridLines, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#38BDF8"
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>

        {/* Concrete tower footings with galvanised base plates */}
        {tower.footingCorners.map(([fx, fz], i) => (
          <group key={`footing-${i}`} position={[fx, 0.07, fz]}>
            <mesh>
              <boxGeometry args={[0.17, 0.09, 0.17]} />
              <meshStandardMaterial color="#6A7482" metalness={0} roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[0.1, 0.012, 0.1]} />
              <meshStandardMaterial color="#C2CBD6" metalness={0.92} roughness={0.36} />
            </mesh>
          </group>
        ))}

        {/* Corner yard telemetry bollards */}
        {[
          [-1.2, -1.0],
          [1.2, -1.0],
          [-1.2, 1.0],
          [1.2, 1.0],
        ].map(([bx, bz], i) => (
          <group key={`bollard-${i}`} position={[bx, 0.08, bz]}>
            <mesh>
              <cylinderGeometry args={[0.014, 0.018, 0.12, 10]} />
              <meshStandardMaterial color="#8894A3" metalness={1} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <sphereGeometry args={[0.016, 10, 10]} />
              <meshBasicMaterial
                color={i % 2 === 0 ? "#FE6E00" : "#38BDF8"}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}

        {/* Survey azimuth halo around the yard */}
        <group ref={yardRingRef} position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <torusGeometry args={[1.92, 0.004, 6, 96]} />
            <meshBasicMaterial color="#FE6E00" transparent opacity={0.35} />
          </mesh>
          <mesh>
            <torusGeometry args={[2.02, 0.0025, 6, 96]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.22} />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          2. LEFT BAY: 220/33kV STEP-DOWN POWER TRANSFORMER
      ===================================================================== */}
      <group position={[-0.82, -1.02, 0.42]}>
        {/* Concrete plinth with oil-containment kerb */}
        <mesh position={[0, -0.245, 0]}>
          <boxGeometry args={[0.68, 0.05, 0.54]} />
          <meshStandardMaterial color="#5B6573" metalness={0} roughness={0.9} />
        </mesh>

        {/* Main tank and bolted lid */}
        <RoundedBox args={[0.46, 0.4, 0.32]} radius={0.018} smoothness={3}>
          <meshStandardMaterial color="#7C8A9B" metalness={0.35} roughness={0.46} />
        </RoundedBox>
        <mesh position={[0, 0.205, 0]}>
          <boxGeometry args={[0.5, 0.022, 0.36]} />
          <meshStandardMaterial color="#5F6C7C" metalness={0.5} roughness={0.42} />
        </mesh>

        {/* Radiator banks on both long faces */}
        {[-1, 1].map((face) =>
          [-0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18].map((fx) => (
            <mesh key={`fin-${face}-${fx}`} position={[fx, -0.01, face * 0.2]}>
              <boxGeometry args={[0.016, 0.31, 0.075]} />
              <meshStandardMaterial
                color="#93A0B0"
                metalness={0.7}
                roughness={0.36}
              />
            </mesh>
          ))
        )}

        {/* Conservator tank on its brackets, with an oil-level gauge */}
        <mesh position={[-0.06, 0.335, -0.09]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.048, 0.26, 6, 16]} />
          <meshStandardMaterial color="#A9B4C2" metalness={0.6} roughness={0.32} />
        </mesh>
        {[-0.16, 0.04].map((bx) => (
          <mesh key={`bracket-${bx}`} position={[bx, 0.255, -0.09]}>
            <boxGeometry args={[0.014, 0.08, 0.05]} />
            <meshStandardMaterial color="#5F6C7C" metalness={0.5} roughness={0.42} />
          </mesh>
        ))}
        <mesh position={[-0.06, 0.335, -0.041]}>
          <circleGeometry args={[0.02, 16]} />
          <meshBasicMaterial color="#FE6E00" toneMapped={false} />
        </mesh>

        {/* Three HV bushings: porcelain sheds up to a phase-coloured terminal */}
        {PHASES.map((phase, bi) => (
          <group key={`bush-${bi}`} position={[(bi - 1) * 0.14, 0.215, 0.04]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.03, 0.036, 0.04, 14]} />
              <meshStandardMaterial color="#5F6C7C" metalness={0.5} roughness={0.42} />
            </mesh>
            {[0, 1, 2, 3, 4].map((d) => (
              <mesh key={d} position={[0, 0.062 + d * 0.04, 0]}>
                <cylinderGeometry args={[0.019 - d * 0.0012, 0.033 - d * 0.0018, 0.03, 16]} />
                <meshStandardMaterial
                  color="#E9EEF3"
                  metalness={0.05}
                  roughness={0.22}
                />
              </mesh>
            ))}
            <mesh position={[0, 0.262, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.04, 8]} />
              <meshStandardMaterial color="#C9D2DC" metalness={1} roughness={0.22} />
            </mesh>
            <mesh position={[0, 0.286, 0]}>
              <sphereGeometry args={[0.018, 12, 12]} />
              <meshBasicMaterial color={phase.color} toneMapped={false} />
            </mesh>
          </group>
        ))}

        {/* Marshalling kiosk with its healthy-status lamp */}
        <mesh position={[0.25, -0.04, 0]}>
          <boxGeometry args={[0.04, 0.16, 0.14]} />
          <meshStandardMaterial color="#4A5564" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0.272, 0.01, 0.03]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color="#10B981" toneMapped={false} />
        </mesh>
      </group>

      {/* =====================================================================
          2B. 3-PHASE TUBULAR BUSBAR BRIDGE ON POST INSULATORS
      ===================================================================== */}
      <group position={[0, -0.88, 0.68]}>
        {[-0.36, 0.36].map((px) => (
          <group key={`gantry-${px}`} position={[px, 0, 0]}>
            <mesh position={[0, -0.24, 0]}>
              <cylinderGeometry args={[0.013, 0.016, 0.34, 10]} />
              <meshStandardMaterial color="#C2CBD6" metalness={0.92} roughness={0.38} />
            </mesh>
            <mesh position={[0, -0.066, 0]}>
              <boxGeometry args={[0.026, 0.016, 0.2]} />
              <meshStandardMaterial color="#C2CBD6" metalness={0.92} roughness={0.38} />
            </mesh>
            {[-0.07, 0, 0.07].map((pz) => (
              <mesh key={pz} position={[0, -0.03, pz]}>
                <cylinderGeometry args={[0.009, 0.014, 0.056, 10]} />
                <meshStandardMaterial color="#E9EEF3" metalness={0.05} roughness={0.22} />
              </mesh>
            ))}
          </group>
        ))}
        {PHASES.map((phase, bi) => (
          <group key={`busbar-${bi}`} position={[0, 0.004, (1 - bi) * 0.07]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.0062, 0.0062, 1.12, 10]} />
              <meshStandardMaterial color="#D5DCE5" metalness={1} roughness={0.22} />
            </mesh>
            {/* Phase identification bands */}
            {[-0.5, 0.5].map((ex) => (
              <mesh key={ex} position={[ex, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.0085, 0.0085, 0.05, 10]} />
                <meshBasicMaterial color={phase.color} toneMapped={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* =====================================================================
          2C. REAR BAY: 3-POLE SF6 CIRCUIT BREAKER
      ===================================================================== */}
      <group position={[-0.84, -1.1, -0.52]}>
        <mesh position={[0, -0.165, 0]}>
          <boxGeometry args={[0.52, 0.05, 0.38]} />
          <meshStandardMaterial color="#5B6573" metalness={0} roughness={0.9} />
        </mesh>
        <RoundedBox
          args={[0.42, 0.2, 0.22]}
          radius={0.014}
          smoothness={2}
          position={[0, -0.04, 0]}
        >
          <meshStandardMaterial color="#7C8A9B" metalness={0.35} roughness={0.46} />
        </RoundedBox>
        {PHASES.map((phase, pi) => (
          <group key={`sf6-${pi}`} position={[(pi - 1) * 0.12, 0.06, 0]}>
            {[0, 1, 2, 3, 4, 5].map((d) => (
              <mesh key={d} position={[0, 0.02 + d * 0.038, 0]}>
                <cylinderGeometry args={[0.017, 0.028, 0.028, 14]} />
                <meshStandardMaterial
                  color="#E9EEF3"
                  metalness={0.05}
                  roughness={0.22}
                />
              </mesh>
            ))}
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.03, 14]} />
              <meshStandardMaterial color="#C9D2DC" metalness={1} roughness={0.22} />
            </mesh>
            <mesh position={[0, 0.278, 0]}>
              <sphereGeometry args={[0.014, 10, 10]} />
              <meshBasicMaterial color={phase.color} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>

      {/* =====================================================================
          3. RIGHT BAY: SCADA TELEMETRY & GIS CONTROL KIOSK
      ===================================================================== */}
      <group position={[0.82, -1.06, 0.44]}>
        <mesh position={[0, -0.205, 0]}>
          <boxGeometry args={[0.62, 0.05, 0.46]} />
          <meshStandardMaterial color="#5B6573" metalness={0} roughness={0.9} />
        </mesh>
        <RoundedBox args={[0.54, 0.36, 0.38]} radius={0.016} smoothness={3}>
          <meshStandardMaterial color="#667383" metalness={0.3} roughness={0.5} />
        </RoundedBox>

        {/* Overhanging roof with a signal-orange fascia */}
        <mesh position={[0, 0.195, 0.02]}>
          <boxGeometry args={[0.6, 0.028, 0.46]} />
          <meshStandardMaterial color="#4E5968" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.195, 0.251]}>
          <boxGeometry args={[0.6, 0.012, 0.004]} />
          <meshBasicMaterial color="#FE6E00" toneMapped={false} />
        </mesh>

        {/* SCADA single-line mimic display */}
        <mesh position={[-0.07, 0.03, 0.191]}>
          <boxGeometry args={[0.32, 0.19, 0.008]} />
          <meshStandardMaterial color="#0A0D12" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[-0.07, 0.03, 0.196]}>
          <planeGeometry args={[0.29, 0.16]} />
          <meshStandardMaterial
            color="#06121F"
            emissive="#0B6FA8"
            emissiveIntensity={0.9}
            roughness={0.3}
          />
        </mesh>
        {[
          { y: 0.075, w: 0.24, color: "#38BDF8" },
          { y: 0.035, w: 0.17, color: "#FFB74D" },
          { y: -0.005, w: 0.21, color: "#FE6E00" },
        ].map((trace) => (
          <mesh key={trace.y} position={[-0.07 - (0.24 - trace.w) / 2, trace.y, 0.197]}>
            <planeGeometry args={[trace.w, 0.01]} />
            <meshBasicMaterial color={trace.color} toneMapped={false} />
          </mesh>
        ))}
        {[-0.15, -0.09, -0.03, 0.03].map((tx) => (
          <mesh key={tx} position={[tx, -0.035, 0.197]}>
            <planeGeometry args={[0.022, 0.022]} />
            <meshBasicMaterial color="#10B981" toneMapped={false} />
          </mesh>
        ))}

        {/* Access door and status lamp */}
        <mesh position={[0.18, -0.02, 0.191]}>
          <boxGeometry args={[0.11, 0.28, 0.008]} />
          <meshStandardMaterial color="#56616F" metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh position={[0.18, 0.145, 0.196]}>
          <boxGeometry args={[0.04, 0.014, 0.006]} />
          <meshBasicMaterial color="#10B981" toneMapped={false} />
        </mesh>

        {/* Roof-mounted telemetry dish */}
        <group ref={radarDishRef} position={[0, 0.29, -0.04]}>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.014, 0.02, 0.09, 10]} />
            <meshStandardMaterial color="#AEB8C5" metalness={1} roughness={0.26} />
          </mesh>
          <group rotation={[0.85, 0, 0]} position={[0, 0.02, 0]}>
            {/* Parabolic reflector: a sphere cap flipped to open along +Y */}
            <mesh rotation={[Math.PI, 0, 0]} position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.1, 24, 10, 0, Math.PI * 2, 0, 0.74]} />
              <meshStandardMaterial
                color="#DDE4EC"
                metalness={0.8}
                roughness={0.25}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0.035, 0]}>
              <cylinderGeometry args={[0.003, 0.003, 0.07, 6]} />
              <meshStandardMaterial color="#AEB8C5" metalness={1} roughness={0.26} />
            </mesh>
            <mesh position={[0, 0.072, 0]}>
              <sphereGeometry args={[0.011, 10, 10]} />
              <meshBasicMaterial color="#38BDF8" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>

      {/* =====================================================================
          4. 220kV DOUBLE-CIRCUIT STEEL LATTICE TRANSMISSION TOWER
          Galvanised angle sections, one instanced draw call for the lot.
      ===================================================================== */}
      <instancedMesh
        ref={steelRef}
        args={[undefined, undefined, tower.members.length]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[1, 1, 1, 6, 1]} />
        <meshStandardMaterial
          color="#C2CBD6"
          metalness={0.92}
          roughness={0.4}
        />
      </instancedMesh>

      {/* =====================================================================
          5. SIX SUSPENSION INSULATOR STRINGS & CORONA RINGS
      ===================================================================== */}
      <instancedMesh
        ref={discRef}
        args={[undefined, undefined, insulators.length * INSULATOR_DISCS]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.037, 0.024, 0.011, 16]} />
        <meshStandardMaterial metalness={0.05} roughness={0.22} />
      </instancedMesh>

      {insulators.map((ins, i) => (
        <group key={`ins-${i}`} position={[ins.x, ins.y, 0]}>
          {/* Ball-and-socket core rod threading the discs */}
          <mesh position={[0, -0.11, 0]}>
            <cylinderGeometry args={[0.0055, 0.0055, 0.225, 6]} />
            <meshStandardMaterial color="#8894A3" metalness={1} roughness={0.3} />
          </mesh>
          {/* Corona field-grading ring and the energised conductor clamp */}
          <mesh position={[0, -0.212, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.0055, 8, 24]} />
            <meshStandardMaterial color="#DDE4EC" metalness={1} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.225, 0]}>
            <sphereGeometry args={[0.016, 10, 10]} />
            <meshBasicMaterial color={ins.color} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          6. THREE-PHASE CONDUCTORS: energised flow lines, passive earth wire
      ===================================================================== */}
      {conductors.map((line) => (
        <mesh key={line.id} geometry={line.geometry} material={line.material} />
      ))}
      <mesh geometry={shieldWire}>
        <meshStandardMaterial color="#9AA6B4" metalness={1} roughness={0.4} />
      </mesh>

      {/* =====================================================================
          7. EARTH-WIRE PEAK, AVIATION MARKER BALLS & OBSTRUCTION LIGHT
      ===================================================================== */}
      {[0.2, 0.42, 0.64].map((u, idx) => {
        // Points along the same sagging curve the earth wire follows
        const inv = 1 - u;
        const y = inv * inv * 1.84 + 2 * inv * u * 1.6 + u * u * 1.72;
        const z = 2 * inv * u * -1.15 + u * u * -2.3;
        return (
          <mesh key={`av-ball-${idx}`} position={[0, y, z]}>
            <sphereGeometry args={[0.034, 16, 12]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? "#FE6E00" : "#F1F4F8"}
              roughness={0.42}
              metalness={0.1}
            />
          </mesh>
        );
      })}

      <group position={[0, 1.84, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.005, 0.011, 0.2, 8]} />
          <meshStandardMaterial color="#C9D2DC" metalness={1} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.012, 12]} />
          <meshStandardMaterial color="#6B7787" metalness={1} roughness={0.3} />
        </mesh>
        <mesh ref={beaconRef} position={[0, 0.215, 0]}>
          <sphereGeometry args={[0.026, 12, 12]} />
          <meshStandardMaterial
            color="#FFD9D0"
            emissive="#FF3B1F"
            emissiveIntensity={4.5}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
