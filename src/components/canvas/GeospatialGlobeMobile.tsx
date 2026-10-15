"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  latLonToVector3,
  buildTerrainDotMatrix,
  buildGreatCircleArc,
  buildLandmarkMarkers,
  buildIndiaCoastlineSegments,
  buildWorldCoastlineSegments,
  buildGraticule,
  sceneSunVector,
} from "@/lib/geo";
import {
  createAtmosphereMaterial,
  createGlobeCoreMaterial,
  createGlobeGridLineMaterial,
  createTerrainDotMatrixMaterial,
  createLandmarkMaterial,
  syncDotMatrixScale,
} from "@/lib/shaders";

interface GeospatialGlobeMobileProps {
  position?: [number, number, number];
  scale?: number;
}

interface MobileHubConfig {
  id: string;
  lat: number;
  lon: number;
  color: string;
  coreColor: string;
  pulseSpeed: number;
  isPrimary?: boolean;
}

function buildMobileIndiaGisMesh(radius: number): Float32Array {
  const nodes: Record<string, [number, number]> = {
    amd: [23.02, 72.57],
    del: [28.61, 77.2],
    mum: [19.07, 72.87],
    rai: [21.25, 81.62],
    hyd: [17.38, 78.48],
    blr: [12.97, 77.59],
    kol: [22.57, 88.36],
  };

  const links: [string, string][] = [
    ["amd", "del"],
    ["amd", "mum"],
    ["amd", "rai"],
    ["del", "rai"],
    ["del", "kol"],
    ["rai", "kol"],
    ["rai", "hyd"],
    ["mum", "hyd"],
    ["mum", "blr"],
    ["hyd", "blr"],
  ];

  const out: number[] = [];
  for (const [aKey, bKey] of links) {
    const [latA, lonA] = nodes[aKey];
    const [latB, lonB] = nodes[bKey];
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const v0 = latLonToVector3(
        latA + (latB - latA) * t0,
        lonA + (lonB - lonA) * t0,
        radius
      );
      const v1 = latLonToVector3(
        latA + (latB - latA) * t1,
        lonA + (lonB - lonA) * t1,
        radius
      );
      out.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
    }
  }
  return new Float32Array(out);
}

function MobileGisHub({
  hub,
  globeRadius,
}: {
  hub: MobileHubConfig;
  globeRadius: number;
}) {
  const waveRingRef = useRef<THREE.Mesh>(null!);

  const { position, quaternion } = useMemo(() => {
    const pos = latLonToVector3(hub.lat, hub.lon, globeRadius);
    const n = pos.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      n
    );
    return { position: pos, quaternion: q };
  }, [hub.lat, hub.lon, globeRadius]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (waveRingRef.current) {
      const p = (t * hub.pulseSpeed) % 1;
      const s = 1 + p * 2.8;
      waveRingRef.current.scale.set(s, s, s);
      const mat = waveRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 * (1 - p));
    }
  });

  const baseRadius = hub.isPrimary ? 0.032 : 0.024;
  const pillarHeight = hub.isPrimary ? 0.11 : 0.08;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.55, baseRadius, 6]} />
        <meshBasicMaterial color={hub.color} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={waveRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.8, baseRadius * 1.2, 6]} />
        <meshBasicMaterial
          color={hub.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, pillarHeight * 0.5, 0]}>
        <cylinderGeometry
          args={[baseRadius * 0.2, baseRadius * 0.4, pillarHeight, 6]}
        />
        <meshBasicMaterial
          color={hub.color}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, pillarHeight * 1.08, 0]}>
        <octahedronGeometry args={[0.013, 0]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

const ARC_POSITION = new THREE.Vector3();

export default function GeospatialGlobeMobile({
  position = [0, 0, 0],
  scale = 1,
}: GeospatialGlobeMobileProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const globeInnerRef = useRef<THREE.Group>(null!);
  const bezelRingRef = useRef<THREE.Group>(null!);
  const caliperRef = useRef<THREE.Mesh>(null!);
  const orbitRingRef = useRef<THREE.Group>(null!);
  const orbitRing2Ref = useRef<THREE.Group>(null!);
  const arcPacketRefs = useRef<THREE.Mesh[]>([]);
  const arcTrailRefs = useRef<THREE.Mesh[]>([]);

  const SUN_VECTOR = useMemo(() => sceneSunVector(), []);

  const terrainMatrix = useMemo(
    () => buildTerrainDotMatrix(3.0, 0.22, 0.012, SUN_VECTOR),
    [SUN_VECTOR]
  );

  const indiaCoastSegments = useMemo(
    () => buildIndiaCoastlineSegments(1.018),
    []
  );
  const indiaElevatedSegments = useMemo(
    () => buildIndiaCoastlineSegments(1.032),
    []
  );
  const indiaGisMeshSegments = useMemo(
    () => buildMobileIndiaGisMesh(1.024),
    []
  );
  const worldCoastSegments = useMemo(
    () => buildWorldCoastlineSegments(1.007),
    []
  );
  const graticule = useMemo(() => buildGraticule(1.0), []);

  const tier1Markers = useMemo(
    () =>
      buildLandmarkMarkers([
        { lat: 23.02, lon: 72.57, color: "#FE6E00" }, // Ahmedabad
        { lat: 21.25, lon: 81.62, color: "#38BDF8" }, // Raipur
        { lat: 48.85, lon: 2.35, color: "#FFB74D" }, // Paris
        { lat: 1.35, lon: 103.82, color: "#10B981" }, // Singapore
      ]),
    []
  );

  const tier2Markers = useMemo(
    () =>
      buildLandmarkMarkers([
        { lat: 19.07, lon: 72.87, color: "#FFFFFF" }, // Mumbai
        { lat: 28.61, lon: 77.2, color: "#FFFFFF" }, // Delhi
        { lat: 12.97, lon: 77.59, color: "#38BDF8" }, // Bengaluru
        { lat: 25.2, lon: 55.27, color: "#FFB74D" }, // Dubai
      ]),
    []
  );

  const hubs: MobileHubConfig[] = useMemo(
    () => [
      {
        id: "ahmedabad",
        lat: 23.02,
        lon: 72.57,
        color: "#FE6E00",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.4,
        isPrimary: true,
      },
      {
        id: "cspdcl-raipur",
        lat: 21.25,
        lon: 81.62,
        color: "#38BDF8",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.6,
      },
      {
        id: "paris-solar",
        lat: 48.85,
        lon: 2.35,
        color: "#FFB74D",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.2,
      },
      {
        id: "cloud-singapore",
        lat: 1.35,
        lon: 103.82,
        color: "#10B981",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.3,
      },
    ],
    []
  );

  const ARCS = useMemo(
    () => [
      {
        id: "raipur",
        curve: buildGreatCircleArc(23.02, 72.57, 21.25, 81.62, 1.02, 0.14),
        color: "#FE6E00",
        packets: 2,
        speed: 0.65,
      },
      {
        id: "paris",
        curve: buildGreatCircleArc(23.02, 72.57, 48.85, 2.35, 1.02, 0.34),
        color: "#FFB74D",
        packets: 2,
        speed: 0.42,
      },
      {
        id: "singapore",
        curve: buildGreatCircleArc(23.02, 72.57, 1.35, 103.82, 1.02, 0.24),
        color: "#10B981",
        packets: 2,
        speed: 0.48,
      },
      {
        id: "bengaluru",
        curve: buildGreatCircleArc(23.02, 72.57, 12.97, 77.59, 1.02, 0.12),
        color: "#38BDF8",
        packets: 2,
        speed: 0.72,
      },
    ],
    []
  );

  const arcTubes = useMemo(
    () =>
      ARCS.map((a) => new THREE.TubeGeometry(a.curve, 24, 0.0045, 5, false)),
    [ARCS]
  );

  const coreMaterial = useMemo(
    () => createGlobeCoreMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );
  const dotMaterial = useMemo(
    () => createTerrainDotMatrixMaterial({ size: 0.046, opacity: 0.96 }),
    []
  );
  const atmosphereMaterial = useMemo(
    () => createAtmosphereMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );
  const landmarkMaterial = useMemo(() => createLandmarkMaterial(0.125), []);
  const landmarkSecondaryMaterial = useMemo(
    () => createLandmarkMaterial(0.082),
    []
  );
  const graticuleMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#334155", opacity: 0.36 }),
    []
  );
  const equatorMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.52 }),
    []
  );
  const worldCoastMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.56 }),
    []
  );
  const indiaCoastMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#FE6E00", opacity: 0.96 }),
    []
  );
  const indiaElevatedMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#FFB74D", opacity: 0.72 }),
    []
  );
  const indiaMeshMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.65 }),
    []
  );

  useEffect(
    () => () => {
      coreMaterial.dispose();
      dotMaterial.dispose();
      atmosphereMaterial.dispose();
      landmarkMaterial.dispose();
      landmarkSecondaryMaterial.dispose();
      graticuleMaterial.dispose();
      equatorMaterial.dispose();
      worldCoastMaterial.dispose();
      indiaCoastMaterial.dispose();
      indiaElevatedMaterial.dispose();
      indiaMeshMaterial.dispose();
      arcTubes.forEach((g) => g.dispose());
    },
    [
      coreMaterial,
      dotMaterial,
      atmosphereMaterial,
      landmarkMaterial,
      landmarkSecondaryMaterial,
      graticuleMaterial,
      equatorMaterial,
      worldCoastMaterial,
      indiaCoastMaterial,
      indiaElevatedMaterial,
      indiaMeshMaterial,
      arcTubes,
    ]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (globeInnerRef.current) {
      globeInnerRef.current.rotation.y = 3.02 + Math.sin(t * 0.26) * 0.18;
      globeInnerRef.current.rotation.x = 0.28 + Math.cos(t * 0.2) * 0.04;
    }

    syncDotMatrixScale(dotMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(landmarkMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(
      landmarkSecondaryMaterial,
      state.size.height,
      state.viewport.dpr
    );

    if (landmarkMaterial.uniforms?.uTime) {
      landmarkMaterial.uniforms.uTime.value = t;
    }
    if (landmarkSecondaryMaterial.uniforms?.uTime) {
      landmarkSecondaryMaterial.uniforms.uTime.value = t * 0.65 + 1.5;
    }
    if (coreMaterial.uniforms?.uTime) {
      coreMaterial.uniforms.uTime.value = t;
    }

    if (bezelRingRef.current) {
      bezelRingRef.current.rotation.y = t * 0.08;
    }
    if (caliperRef.current) {
      caliperRef.current.rotation.z = t * 0.34;
    }
    if (orbitRingRef.current) {
      orbitRingRef.current.rotation.z = t * 0.36 + 0.5;
    }
    if (orbitRing2Ref.current) {
      orbitRing2Ref.current.rotation.z = -t * 0.28 + 2.2;
    }

    ARCS.forEach((arc, ai) => {
      for (let i = 0; i < arc.packets; i++) {
        const u = (t * arc.speed + ai * 0.3 + i / arc.packets) % 1;
        const packet = arcPacketRefs.current[ai * 3 + i];
        if (packet) {
          arc.curve.getPoint(u, ARC_POSITION);
          packet.position.copy(ARC_POSITION);
        }
        const trail = arcTrailRefs.current[ai * 3 + i];
        if (trail) {
          arc.curve.getPoint((u - 0.045 + 1) % 1, ARC_POSITION);
          trail.position.copy(ARC_POSITION);
        }
      }
    });

    if (rootGroupRef.current) {
      const targetRotY = state.pointer.x * 0.2;
      const targetRotX = -state.pointer.y * 0.14;
      rootGroupRef.current.rotation.y = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.y,
        targetRotY,
        4,
        delta
      );
      rootGroupRef.current.rotation.x = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.x,
        targetRotX,
        4,
        delta
      );
    }
  });

  return (
    <group ref={rootGroupRef} position={position} scale={scale}>
      <group ref={globeInnerRef} rotation={[0.28, 3.02, 0]}>
        <mesh material={coreMaterial}>
          <sphereGeometry args={[0.985, 36, 36]} />
        </mesh>

        <mesh material={atmosphereMaterial}>
          <sphereGeometry args={[1.055, 36, 36]} />
        </mesh>

        <lineSegments material={graticuleMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.standard, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        <lineSegments material={equatorMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.equator, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        <lineSegments material={worldCoastMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[worldCoastSegments, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        <lineSegments material={indiaCoastMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[indiaCoastSegments, 3]}
            />
          </bufferGeometry>
        </lineSegments>
        <lineSegments material={indiaElevatedMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[indiaElevatedSegments, 3]}
            />
          </bufferGeometry>
        </lineSegments>
        <lineSegments material={indiaMeshMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[indiaGisMeshSegments, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        <points material={dotMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[terrainMatrix.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[terrainMatrix.colors, 3]}
            />
          </bufferGeometry>
        </points>

        <points material={landmarkMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[tier1Markers.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[tier1Markers.colors, 3]}
            />
          </bufferGeometry>
        </points>

        <points material={landmarkSecondaryMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[tier2Markers.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[tier2Markers.colors, 3]}
            />
          </bufferGeometry>
        </points>

        {hubs.map((h) => (
          <MobileGisHub key={h.id} hub={h} globeRadius={1.018} />
        ))}

        {ARCS.map((arc, ai) => (
          <React.Fragment key={arc.id}>
            <mesh geometry={arcTubes[ai]}>
              <meshBasicMaterial
                color={arc.color}
                transparent
                opacity={0.72}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {Array.from({ length: arc.packets }, (_, i) => (
              <React.Fragment key={`${arc.id}-pkt-${i}`}>
                <mesh
                  ref={(el) => {
                    arcTrailRefs.current[ai * 3 + i] = el as THREE.Mesh;
                  }}
                >
                  <sphereGeometry args={[0.009, 6, 6]} />
                  <meshBasicMaterial
                    color={arc.color}
                    transparent
                    opacity={0.4}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    arcPacketRefs.current[ai * 3 + i] = el as THREE.Mesh;
                  }}
                >
                  <sphereGeometry args={[0.014, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </group>

      {/* Observatory Gimbal Bezel, Degree Ticks & Polar Trunnions */}
      <group rotation={[0.16, 0.1, -0.16]}>
        <group ref={bezelRingRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.18, 0.01, 6, 64]} />
            <meshStandardMaterial
              color="#222936"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.155, 0.003, 6, 64]} />
            <meshBasicMaterial color="#FE6E00" transparent opacity={0.65} />
          </mesh>
          {Array.from({ length: 36 }, (_, i) => {
            const angle = (i / 36) * Math.PI * 2;
            const isCard = i % 9 === 0;
            const tickLen = isCard ? 0.06 : 0.025;
            const r = 1.18 + tickLen * 0.5;
            return (
              <mesh
                key={`m-az-${i}`}
                position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
                rotation={[0, -angle, 0]}
              >
                <boxGeometry
                  args={[tickLen, isCard ? 0.01 : 0.005, isCard ? 0.012 : 0.005]}
                />
                <meshBasicMaterial
                  color={isCard ? "#FE6E00" : "#FFB74D"}
                  transparent
                  opacity={isCard ? 0.95 : 0.55}
                />
              </mesh>
            );
          })}
          <mesh ref={caliperRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.205, 0.0055, 6, 36, Math.PI * 0.36]} />
            <meshBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.75}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* Meridional Ring & Polar Trunnion Spindles */}
        <mesh>
          <torusGeometry args={[1.24, 0.007, 6, 64]} />
          <meshStandardMaterial color="#2B3444" metalness={0.85} roughness={0.3} />
        </mesh>
        {[1, -1].map((pole) => (
          <group key={`m-pole-${pole}`} position={[0, pole * 1.11, 0]}>
            <mesh>
              <cylinderGeometry args={[0.044, 0.056, 0.08, 10]} />
              <meshStandardMaterial color="#1E2530" metalness={0.9} roughness={0.22} />
            </mesh>
            <mesh position={[0, pole * 0.08, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Orbit 1: Sun-Synchronous SAR Satellite */}
      <group ref={orbitRingRef} rotation={[0.48, 0.22, 0.68]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.34, 0.0022, 6, 64]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.38} />
        </mesh>
        <group position={[1.34, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.058, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              metalness={0.9}
              roughness={0.2}
              emissive="#D97706"
              emissiveIntensity={0.45}
            />
          </mesh>
          {[-1, 1].map((dir) => (
            <mesh key={dir} position={[0, 0, dir * 0.1]}>
              <boxGeometry args={[0.048, 0.003, 0.14]} />
              <meshStandardMaterial
                color="#1E3A8A"
                metalness={0.7}
                roughness={0.3}
                emissive="#38BDF8"
                emissiveIntensity={0.55}
              />
            </mesh>
          ))}
          <mesh position={[-0.16, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.085, 0.32, 12, 1, true]} />
            <meshBasicMaterial
              color="#FE6E00"
              transparent
              opacity={0.18}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[-0.32, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <ringGeometry args={[0.07, 0.088, 6]} />
            <meshBasicMaterial
              color="#FE6E00"
              side={THREE.DoubleSide}
              transparent
              opacity={0.65}
            />
          </mesh>
        </group>
      </group>

      {/* Orbit 2: Inclined GNSS Relay Satellite */}
      <group ref={orbitRing2Ref} rotation={[-0.42, -0.32, -0.5]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.41, 0.002, 6, 64]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.3} />
        </mesh>
        <group position={[1.41, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.052, 8]} />
            <meshStandardMaterial color="#1E2430" metalness={0.85} roughness={0.28} />
          </mesh>
          {[-1, 1].map((dir) => (
            <mesh key={dir} position={[0, 0, dir * 0.095]}>
              <boxGeometry args={[0.044, 0.003, 0.13]} />
              <meshStandardMaterial
                color="#1E3A8A"
                emissive="#2563EB"
                emissiveIntensity={0.5}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
