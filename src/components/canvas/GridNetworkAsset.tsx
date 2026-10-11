"use client";

import React, { useRef, useMemo, useEffect } from "react";import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createDiscMaterial, createDotMatrixMaterial, syncDotMatrixScale } from "@/lib/shaders";

// Three-phase circuit. A 220 kV double-circuit tower carries two independent
// three-phase circuits on opposite sides of the crossarms, plus two earth
// (shield) wires on the peak. Phases use the Indian standard colour code —
// R, Y and B — which is what actually gets painted on the hardware.
const PHASES = [
  { phase: "R", color: "#E23B3B" }, // Red phase
  { phase: "Y", color: "#E8B33A" }, // Yellow phase
  { phase: "B", color: "#3B6FE2" }, // Blue phase
];

/**
 * Zigzag web members for a lattice cross-arm: alternating diagonals between the
 * upper and lower chords, with a vertical at every node. Returned as flat
 * line-segment vertices in the arm's local space.
 */
function crossArmWeb(span: number): Float32Array {
  const half = span / 2;
  const dy = 0.085;
  const segments = 8;
  const step = span / segments;
  const pts: number[] = [];

  for (let i = 0; i < segments; i++) {
    const x0 = -half + i * step;
    const x1 = x0 + step;
    const rising = i % 2 === 0;
    pts.push(x0, rising ? -dy : dy, 0, x1, rising ? dy : -dy, 0);
    pts.push(x1, dy, 0, x1, -dy, 0);
  }
  return new Float32Array(pts);
}

export default function GridNetworkAsset({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number];
  scale?: number;
}) {
  const rootRef = useRef<THREE.Group>(null!);
  const padRef = useRef<THREE.Group>(null!);
  const conductorsRef = useRef<THREE.Group>(null!);
  const anemometerRef = useRef<THREE.Group>(null!);
  const radarHeadRef = useRef<THREE.Group>(null!);
  const beaconRef = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);

  // One arc ref per insulator string (six suspension clusters)
  const arcRefs = [
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
  ];

  // Two earth (shield) wires run along the tower peak, above the phase
  // conductors, to intercept lightning strikes. They are continuous across the
  // structure rather than terminating at it.
  const SHIELD_WIRES = useMemo(() => {
    const peakY = 1.32;
    const specs = [
      { x: -0.22, dir: -1, sag: 0.42, len: 3.4 },
      { x: 0.22, dir: -1, sag: 0.42, len: 3.4 },
    ];
    return specs.map((s) => {
      const start = new THREE.Vector3(s.x, peakY, 0);
      const end = new THREE.Vector3(s.x, peakY, s.dir * s.len);
      const mid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5);
      mid.y -= s.sag;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      return {
        geometry: new THREE.TubeGeometry(curve, 12, 0.005, 4, false),
      };
    });
  }, []);

  // Corona haze blooming off the reactor core
  const coronaMaterial = useMemo(
    () => createDiscMaterial({ color: "#FE6E00", intensity: 0.3 }),
    []
  );
  useEffect(() => () => coronaMaterial.dispose(), [coronaMaterial]);

  // High-voltage arc jitter — additive, single thin quad per string
  const arcJitterMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#FFFFFF",
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  useEffect(() => () => arcJitterMaterial.dispose(), [arcJitterMaterial]);

  // Ring-and-spoke survey pad drawn under the structure so it reads as a real
  // installation standing on surveyed ground rather than floating in the void.
  const PAD_RINGS = [0.45, 0.8, 1.15, 1.5, 1.85];
  const PAD_SPOKES = 12;

  // Span dimension ticks: end caps plus the span line between them
  const SPAN_MARKER = useMemo(() => {
    const half = 2.4;
    const tick = 0.1;
    return new Float32Array([
      // Span line
      -half, 0, 0, half, 0, 0,
      // End caps
      -half, -tick, 0, -half, tick, 0,
      half, -tick, 0, half, tick, 0,
    ]);
  }, []);

  // A 220 kV suspension string uses roughly a dozen cap-and-pin discs
  const INSULATOR_DISCS = 12;

  // Cross-bracing panels: transmission tower bodies are braced X-patterns at
  // each panel point, not a plain tube. Generated across four faces.
  const CROSS_BRACING = useMemo(() => {
    const panels = [
      { y0: -0.9, y1: -0.3, r0: 0.62, r1: 0.4 },
      { y0: -0.3, y1: 0.25, r0: 0.4, r1: 0.26 },
      { y0: 0.25, y1: 0.85, r0: 0.26, r1: 0.18 },
    ];
    const segments: number[] = [];
    for (const p of panels) {
      for (let face = 0; face < 4; face++) {
        const a = (face / 4) * Math.PI * 2 + Math.PI / 4;
        const aNext = ((face + 1) / 4) * Math.PI * 2 + Math.PI / 4;

        const bl = [Math.cos(a) * p.r0, p.y0, Math.sin(a) * p.r0];
        const br = [Math.cos(aNext) * p.r0, p.y0, Math.sin(aNext) * p.r0];
        const tl = [Math.cos(a) * p.r1, p.y1, Math.sin(a) * p.r1];
        const tr = [Math.cos(aNext) * p.r1, p.y1, Math.sin(aNext) * p.r1];

        // Two diagonals forming the X in this panel
        segments.push(...bl, ...tr);
        segments.push(...br, ...tl);
        // Horizontal strut at the panel point
        segments.push(...bl, ...br);
      }
    }
    return new Float32Array(segments);
  }, []);

  // Stay cables from the mast crown out to the pad perimeter
  const GUY_WIRES = [0.785, 2.356, 3.927, 5.498].map((a) => [
    0, 1.9, 0,
    Math.cos(a) * 1.8, -1.28, Math.sin(a) * 1.8,
  ]);

  const CONDUCTORS = useMemo(() => {
    const anchorY = 0.55;
    // Two circuits: the left-hand circuit occupies the far arm, the right-hand
    // circuit the near arm. Within each circuit the three phases sit at the
    // outer, middle and inner positions.
    const specs = [
      // Circuit A (rear)
      { x: -0.9, dir: -1, sag: 0.32, len: 3.2, phase: "B" },
      { x: -0.6, dir: -1, sag: 0.28, len: 3.0, phase: "Y" },
      { x: -0.3, dir: -1, sag: 0.28, len: 3.0, phase: "R" },
      // Circuit B (front)
      { x: 0.3, dir: 1, sag: 0.28, len: 3.0, phase: "R" },
      { x: 0.6, dir: 1, sag: 0.28, len: 3.0, phase: "Y" },
      { x: 0.9, dir: 1, sag: 0.32, len: 3.2, phase: "B" },
    ];

    const phaseColor = (p: string) =>
      PHASES.find((ph) => ph.phase === p)?.color ?? "#FE6E00";

    return specs.map((s, i) => {
      const start = new THREE.Vector3(s.x, anchorY, 0.12);
      const end = new THREE.Vector3(s.x, anchorY, s.dir * s.len);
      const mid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5);
      mid.y -= s.sag;
      // Gentle lateral drift over the run so the corridor does not look ruled
      mid.x += (i % 2 === 0 ? 0.12 : -0.12) * s.dir;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      return {
        id: `conductor-${i}`,
        curve,
        phase: s.phase,
        color: phaseColor(s.phase),
        geometry: new THREE.TubeGeometry(curve, 12, 0.008, 4, false),
      };
    });
  }, []);

  // Travelling current pulse: one points draw call for every conductor, tinted
  // by that conductor's phase so the pulse on a red phase reads red.
  const pulsePositions = useMemo(
    () => new Float32Array(CONDUCTORS.length * 3),
    [CONDUCTORS]
  );
  const pulseColors = useMemo(() => {
    const arr = new Float32Array(CONDUCTORS.length * 3);
    const c = new THREE.Color();
    CONDUCTORS.forEach((cond, i) => {
      c.set(cond.color);
      // Brighten toward white so the pulse stands out from the conductor itself
      arr[i * 3] = c.r + (1 - c.r) * 0.45;
      arr[i * 3 + 1] = c.g + (1 - c.g) * 0.45;
      arr[i * 3 + 2] = c.b + (1 - c.b) * 0.45;
    });
    return arr;
  }, [CONDUCTORS]);
  const pulseGeometryRef = useRef<THREE.BufferGeometry>(null!);
  const pulseMaterial = useMemo(
    () => createDotMatrixMaterial({ size: 0.055, opacity: 1, nightDim: 1 }),
    []
  );
  const PULSE_POSITION = useMemo(() => new THREE.Vector3(), []);

  useEffect(
    () => () => {
      CONDUCTORS.forEach((c) => c.geometry.dispose());
      SHIELD_WIRES.forEach((w) => w.geometry.dispose());
      pulseMaterial.dispose();
    },
    [CONDUCTORS, SHIELD_WIRES, pulseMaterial]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Constant slow orientation drift
    if (rootRef.current) {
      rootRef.current.rotation.y += delta * 0.12;
    }

    // Rotating 360 degree LIDAR / telemetry sensor head
    if (radarHeadRef.current) {
      radarHeadRef.current.rotation.y += delta * 1.8;
    }

    // Warning strobe beacon + reactor core driven by emissive intensity, not lights
    if (beaconRef.current) {
      const strobe = Math.sin(t * 8) > 0.6 ? 6.0 : 0.4;
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = strobe;
    }

    if (coreRef.current) {
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        3.5 + Math.sin(t * 12) * 1.6;
    }

    // Insulator arcs crackle on independent, unsynchronised phases
    arcRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const phase = t * 9 + i * 2.3;
      const crackle = Math.sin(phase) * Math.sin(phase * 2.7);
      ref.current.visible = crackle > 0.55;
      ref.current.scale.y = 0.6 + crackle * 1.1;
      ref.current.rotation.z = Math.sin(phase * 1.3) * 0.4;
    });

    // Survey pad counter-rotates slowly for a live, surveyed feel
    if (padRef.current) {
      padRef.current.rotation.z -= delta * 0.08;
    }

    // Anemometer spins with the prevailing wind
    if (anemometerRef.current) {
      anemometerRef.current.rotation.y += delta * 2.4;
    }

    // Corona discharges brightest when the plasma core peaks
    if (coreRef.current && coronaMaterial.uniforms?.uIntensity) {
      const pulse = 0.5 + Math.abs(Math.sin(t * 12)) * 0.5;
      coronaMaterial.uniforms.uIntensity.value = 0.25 + pulse * 0.5;
    }

    // Push the current pulse along each conductor
    for (let i = 0; i < CONDUCTORS.length; i++) {
      const u = (t * (0.12 + i * 0.02) + i * 0.17) % 1;
      CONDUCTORS[i].curve.getPoint(u, PULSE_POSITION);
      pulsePositions[i * 3] = PULSE_POSITION.x;
      pulsePositions[i * 3 + 1] = PULSE_POSITION.y;
      pulsePositions[i * 3 + 2] = PULSE_POSITION.z;
    }
    if (pulseGeometryRef.current) {
      (pulseGeometryRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    syncDotMatrixScale(pulseMaterial, state.size.height, state.viewport.dpr);
  });

  return (
    <group ref={rootRef} position={position} scale={scale}>
      <group ref={padRef} position={[0, -1.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {PAD_RINGS.map((r, i) => (
          <mesh key={`ring-${i}`}>
            <torusGeometry args={[r, i % 2 === 0 ? 0.006 : 0.003, 4, 64]} />
            <meshBasicMaterial
              color="#FFB74D"
              transparent
              opacity={i % 2 === 0 ? 0.4 : 0.2}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
        {Array.from({ length: PAD_SPOKES }, (_, s) => {
          const a = (s / PAD_SPOKES) * Math.PI * 2;
          return (
            <mesh
              key={`spoke-${s}`}
              position={[Math.cos(a) * 0.925, Math.sin(a) * 0.925, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[1.85, 0.004, 0.004]} />
              <meshBasicMaterial
                color="#FFB74D"
                transparent
                opacity={0.14}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}

        {/* Corner survey markers at the pad perimeter */}
        {Array.from({ length: 4 }, (_, k) => {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={`corner-${k}`}
              position={[Math.cos(a) * 1.85, Math.sin(a) * 1.85, 0]}
            >
              <boxGeometry args={[0.09, 0.09, 0.012]} />
              <meshBasicMaterial
                color="#FE6E00"
                transparent
                opacity={0.55}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* 1. Substation Concrete Foundation Base */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[1.1, 1.3, 0.25, 8]} />
        <meshStandardMaterial
          color="#1A1A1A"
          metalness={0.8}
          roughness={0.4}
        />
      </mesh>

      {/* Independent concrete footings, one under each leg, with the steel stub
          angle cast into the concrete and bolted to the leg above it. */}
      {[0.785, 2.356, 3.927, 5.498].map((a, i) => (
        <group key={`footing-${i}`} position={[Math.cos(a) * 1.02, -1.26, Math.sin(a) * 1.02]}>
          <mesh>
            <boxGeometry args={[0.3, 0.14, 0.3]} />
            <meshStandardMaterial
              color="#242424"
              metalness={0.4}
              roughness={0.7}
            />
          </mesh>
          {/* Stub angle rising out of the concrete into the leg */}
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.07, 0.14, 0.07]} />
            <meshStandardMaterial color="#8A8A8A" metalness={0.9} roughness={0.4} />
          </mesh>
          {/* Holding-down bolts */}
          {[
            [-0.09, -0.09],
            [0.09, -0.09],
            [-0.09, 0.09],
            [0.09, 0.09],
          ].map(([bx, bz], b) => (
            <mesh key={`bolt-${b}`} position={[bx, 0.11, bz]}>
              <cylinderGeometry args={[0.008, 0.008, 0.1, 5]} />
              <meshStandardMaterial color="#C9C9C9" metalness={0.95} roughness={0.25} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Guy wires anchoring the mast to the survey pad corners */}
      {GUY_WIRES.map((w, i) => (
        <line key={`guy-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(w), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#FE6E00"
            transparent
            opacity={0.3}
          />
        </line>
      ))}

      {/* 1b. RTU control cabinet with a live status display */}
      <group position={[-0.85, -1.02, 0.55]}>
        <mesh>
          <boxGeometry args={[0.34, 0.5, 0.22]} />
          <meshStandardMaterial
            color="#242424"
            metalness={0.7}
            roughness={0.4}
          />
        </mesh>
        {/* Status readout */}
        <mesh position={[0, 0.13, 0.115]}>
          <boxGeometry args={[0.22, 0.09, 0.01]} />
          <meshStandardMaterial
            color="#00C758"
            emissive="#00C758"
            emissiveIntensity={4}
          />
        </mesh>
        {/* Ventilation slats */}
        {[0, 1, 2].map((v) => (
          <mesh key={v} position={[0, -0.02 - v * 0.055, 0.115]}>
            <boxGeometry args={[0.26, 0.016, 0.01]} />
            <meshStandardMaterial color="#141414" metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Weather station: anemometer cups spinning with the wind */}
      <group position={[0.42, 1.98, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.3, 4]} />
          <meshStandardMaterial color="#8A8A8A" metalness={0.9} />
        </mesh>
        <group ref={anemometerRef} position={[0, 0.3, 0]}>
          {[0, 2.09, 4.19].map((a, i) => (
            <group key={i} rotation={[0, a, 0]}>
              <mesh position={[0.05, 0, 0]}>
                <cylinderGeometry args={[0.002, 0.002, 0.07, 4]} />
                <meshStandardMaterial color="#C9A227" metalness={0.9} />
              </mesh>
              <mesh position={[0.09, 0, 0]}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshStandardMaterial
                  color="#D6D6D6"
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* 2. Lower Steel Truss Mast (Pyramidal 4-leg lattice) */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.3, 0.7, 1.4, 4]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#7A2B0E"
          emissiveIntensity={0.8}
          wireframe
        />
      </mesh>

      {/* 3. Middle Steel Truss Mast */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.18, 0.3, 1.2, 4]} />
        <meshStandardMaterial
          color="#FFB74D"
          emissive="#A33D14"
          emissiveIntensity={0.9}
          wireframe
        />
      </mesh>

      {/* X-bracing at each panel point, the load path of a real lattice tower */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[CROSS_BRACING, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FFB74D" transparent opacity={0.85} />
      </lineSegments>

      {/* 4. Cross-arms. Two chord tubes per arm with zigzag bracing between them,
          the way a real lattice cross-arm is built, instead of a bare cylinder. */}
      {[
        { y: 1.1, span: 1.8, chord: 0.016 },
        { y: 0.7, span: 2.2, chord: 0.014 },
      ].map((arm, ai) => (
        <group key={`arm-${ai}`} position={[0, arm.y, 0]}>
          {/* Upper and lower chords */}
          {[0.085, -0.085].map((dy, ci) => (
            <mesh key={ci} position={[0, dy, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[arm.chord, arm.chord, arm.span, 6]} />
              <meshStandardMaterial color="#C9C9C9" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
          {/* Zigzag web members between the chords */}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[crossArmWeb(arm.span), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#FFB74D" transparent opacity={0.9} />
          </lineSegments>
        </group>
      ))}

      {/* 5. Suspension insulator strings. Cap-and-pin discs spaced so the gaps
          between them stay open — packed any tighter they fuse into one ribbed
          column and stop reading as a string of discs. */}
      {[-0.9, -0.6, -0.3, 0.3, 0.6, 0.9].map((xOffset, i) => (
        <group key={i} position={[xOffset, 0.55, 0]}>
          {Array.from({ length: INSULATOR_DISCS }, (_, d) => (
            <mesh key={d} position={[0, 0.09 - d * 0.03, 0]}>
              <cylinderGeometry args={[0.05, 0.038, 0.009, 10]} />
              <meshStandardMaterial
                color="#D9D2C6"
                emissive="#FE6E00"
                emissiveIntensity={0.5}
                metalness={0.35}
                roughness={0.55}
              />
            </mesh>
          ))}
          {/* Conductor cable terminal clamp, at the foot of the string */}
          <mesh position={[0, -0.28, 0]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>

          {/* Corona ring: fitted around the clamp to grade the electric field at
              the conductor termination, which is why real hardware has them. */}
          <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.008, 5, 16]} />
            <meshStandardMaterial color="#C9C9C9" metalness={0.9} roughness={0.3} />
          </mesh>

          {/* Arc leaping across the full disc string */}
          <mesh ref={arcRefs[i]} position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.0045, 0.0045, 0.36, 4]} />
            <primitive object={arcJitterMaterial} attach="material" />
          </mesh>
        </group>
      ))}

      {/* High-voltage transmission conductors: real catenary sag out to the
          horizon in both directions, coloured by phase. */}
      <group ref={conductorsRef}>
        {CONDUCTORS.map((c) => (
          <mesh key={c.id} geometry={c.geometry}>
            <meshBasicMaterial
              color={c.color}
              transparent
              opacity={0.62}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* Travelling current pulses riding the conductors */}
        <points material={pulseMaterial}>
          <bufferGeometry ref={pulseGeometryRef}>
            <bufferAttribute
              attach="attributes-position"
              args={[pulsePositions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[pulseColors, 3]}
            />
          </bufferGeometry>
        </points>
      </group>

      {/* Rotating Corona Discharge Ring */}
      <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.015, 6, 18]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#FE6E00"
          emissiveIntensity={3}
          wireframe
        />
      </mesh>

      {/* 6. High-Voltage Plasma Reactor Core (emissive pulse replaces the point light) */}
      <mesh ref={coreRef} position={[0, 1.45, 0]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#FE6E00"
          emissiveIntensity={3.5}
        />
      </mesh>

      {/* Corona haze blooming off the reactor core */}
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.32, 12, 12]} />
        <primitive object={coronaMaterial} attach="material" />
      </mesh>

      {/* 7. Rotating Top LIDAR Sensor Head */}
      <group ref={radarHeadRef} position={[0, 1.75, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 10]} />
          <meshStandardMaterial color="#2E2E2E" metalness={0.9} />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <boxGeometry args={[0.06, 0.03, 0.03]} />
          <meshStandardMaterial
            color="#00C758"
            emissive="#00C758"
            emissiveIntensity={3}
          />
        </mesh>
      </group>

      {/* Danger notice. Live-line towers carry a permanent hazard plate with the
          circuit voltage so ground crews and the public can identify the asset. */}
      <group position={[0, -0.62, 0.42]}>
        <mesh>
          <boxGeometry args={[0.26, 0.18, 0.012]} />
          <meshStandardMaterial color="#E8E8E8" roughness={0.6} />
        </mesh>
        {/* Hazard triangle, drawn as a filled chevron */}
        <mesh position={[0, 0.035, 0.008]}>
          <circleGeometry args={[0.032, 3]} />
          <meshBasicMaterial color="#1A1A1A" />
        </mesh>
        {/* Voltage band across the plate */}
        <mesh position={[0, -0.045, 0.008]}>
          <boxGeometry args={[0.2, 0.022, 0.004]} />
          <meshBasicMaterial color="#1A1A1A" />
        </mesh>
      </group>

      {/* Span dimension: the horizontal distance to the adjacent structure, marked
          the way a line survey drawing dimensions the corridor. */}
      <group position={[0, -0.95, 0]}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[SPAN_MARKER, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FFB74D" transparent opacity={0.5} />
        </lineSegments>
      </group>

      {/* Earth / shield wires on the peak, sagging continuously across the run */}
      {SHIELD_WIRES.map((w, i) => (
        <mesh key={`shield-${i}`} geometry={w.geometry}>
          <meshBasicMaterial
            color="#B8B8B8"
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}

      {/* Structure identification plate. Every tower on a transmission line
          carries its number so field crews can report faults by location. */}
      <group position={[0, -0.05, 0.46]}>
        <mesh>
          <boxGeometry args={[0.3, 0.16, 0.012]} />
          <meshStandardMaterial
            color="#D8D8D8"
            metalness={0.6}
            roughness={0.5}
          />
        </mesh>
        {/* Number bands, painted on the plate */}
        {[0, 1, 2].map((i) => (
          <mesh key={`id-${i}`} position={[-0.09 + i * 0.09, 0, 0.008]}>
            <boxGeometry args={[0.055, 0.1, 0.004]} />
            <meshBasicMaterial color="#1A1A1A" />
          </mesh>
        ))}
      </group>

      {/* Bird diverters: the striped markers hung on shield wires to make the
          line visible to low-flying aircraft. */}
      {SHIELD_WIRES.map((_, wi) =>
        [0.85, 1.7, 2.55].map((t, i) => {
          const z = -t;
          return (
            <mesh key={`div-${wi}-${i}`} position={[wi === 0 ? -0.22 : 0.22, 1.1, z]}>
              <boxGeometry args={[0.05, 0.05, 0.008]} />
              <meshBasicMaterial color="#E8B33A" />
            </mesh>
          );
        })
      )}

      {/* Tower crown: three angled peak arms with chrome tips and an arrestor rod */}
      <group position={[0, 1.95, 0]}>
        {[0, 2.09, 4.19].map((a, i) => (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0.16, 0.1, 0]} rotation={[0, 0, -0.6]}>
              <cylinderGeometry args={[0.006, 0.006, 0.3, 5]} />
              <meshStandardMaterial color="#FE6E00" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0.28, 0.24, 0]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshStandardMaterial
                color="#D6D6D6"
                metalness={0.95}
                roughness={0.15}
              />
            </mesh>
          </group>
        ))}
        {/* Lightning arrestor */}
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.5, 5]} />
          <meshStandardMaterial color="#C9A227" metalness={0.95} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.54, 0]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial
            color="#FE6E00"
            emissive="#FE6E00"
            emissiveIntensity={5}
          />
        </mesh>
      </group>

      {/* 8. Apex Aviation Warning Strobe (emissive flash replaces the point light) */}
      <mesh ref={beaconRef} position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FE6E00"
          emissiveIntensity={3.0}
        />
      </mesh>
    </group>
  );
}
