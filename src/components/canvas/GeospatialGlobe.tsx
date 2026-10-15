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

interface GeospatialGlobeProps {
  position?: [number, number, number];
  scale?: number;
}

interface GisHubConfig {
  id: string;
  lat: number;
  lon: number;
  color: string;
  coreColor: string;
  pulseSpeed: number;
  isPrimary?: boolean;
}

/**
 * Builds a triangulated spatial GIS network mesh across India's key engineering
 * and deployment hubs.
 */
function buildIndiaGisMesh(radius: number): Float32Array {
  const nodes: Record<string, [number, number]> = {
    amd: [23.02, 72.57], // Ahmedabad
    vad: [22.3, 73.18],  // Vadodara
    jai: [26.9, 75.8],   // Jaipur
    del: [28.61, 77.2],  // Delhi
    mum: [19.07, 72.87], // Mumbai
    rai: [21.25, 81.62], // Raipur
    hyd: [17.38, 78.48], // Hyderabad
    blr: [12.97, 77.59], // Bengaluru
    che: [13.08, 80.27], // Chennai
    kol: [22.57, 88.36], // Kolkata
  };

  const links: [string, string][] = [
    ["amd", "vad"],
    ["amd", "jai"],
    ["amd", "mum"],
    ["vad", "mum"],
    ["vad", "rai"],
    ["jai", "del"],
    ["jai", "rai"],
    ["del", "rai"],
    ["del", "kol"],
    ["rai", "kol"],
    ["rai", "hyd"],
    ["mum", "hyd"],
    ["mum", "blr"],
    ["hyd", "blr"],
    ["hyd", "che"],
    ["blr", "che"],
  ];

  const out: number[] = [];
  for (const [aKey, bKey] of links) {
    const [latA, lonA] = nodes[aKey];
    const [latB, lonB] = nodes[bKey];
    const steps = 6;
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

function GisSurfaceHub({
  hub,
  globeRadius,
}: {
  hub: GisHubConfig;
  globeRadius: number;
}) {
  const waveRingRef = useRef<THREE.Mesh>(null!);
  const outerWaveRef = useRef<THREE.Mesh>(null!);

  const { position, quaternion } = useMemo(() => {
    const pos = latLonToVector3(hub.lat, hub.lon, globeRadius);
    const normal = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );
    return { position: pos, quaternion: quat };
  }, [hub.lat, hub.lon, globeRadius]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (waveRingRef.current) {
      const p = (t * hub.pulseSpeed) % 1;
      const s = 1 + p * (hub.isPrimary ? 3.2 : 2.4);
      waveRingRef.current.scale.set(s, s, s);
      const mat = waveRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 * (1 - p));
    }
    if (outerWaveRef.current) {
      const p2 = (t * hub.pulseSpeed + 0.5) % 1;
      const s2 = 1 + p2 * (hub.isPrimary ? 3.2 : 2.4);
      outerWaveRef.current.scale.set(s2, s2, s2);
      const mat = outerWaveRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.65 * (1 - p2));
    }
  });

  const baseRadius = hub.isPrimary ? 0.028 : 0.02;
  const pillarHeight = hub.isPrimary ? 0.11 : 0.075;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.55, baseRadius, 6]} />
        <meshBasicMaterial
          color={hub.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.95}
        />
      </mesh>

      <mesh ref={waveRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.8, baseRadius * 1.15, 6]} />
        <meshBasicMaterial
          color={hub.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={outerWaveRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.8, baseRadius * 1.15, 6]} />
        <meshBasicMaterial
          color={hub.coreColor}
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, pillarHeight * 0.5, 0]}>
        <cylinderGeometry
          args={[baseRadius * 0.18, baseRadius * 0.38, pillarHeight, 6]}
        />
        <meshBasicMaterial
          color={hub.color}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, pillarHeight * 0.55, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, pillarHeight * 1.1, 6]} />
        <meshBasicMaterial color={hub.coreColor} />
      </mesh>

      <mesh position={[0, pillarHeight * 1.12, 0]}>
        <octahedronGeometry args={[hub.isPrimary ? 0.014 : 0.01, 0]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

/**
 * Miniature Earth-Observation Satellite with gold MLI bus, twin photovoltaic
 * wings, nadir laser boresight, and a projected surface swath ring.
 */
function OrbitalSatelliteUnit({
  radius,
  accentColor,
  solarColor = "#2563EB",
}: {
  radius: number;
  accentColor: string;
  solarColor?: string;
}) {
  const beamLen = radius - 1.02;

  return (
    <group position={[radius, 0, 0]}>
      {/* Central octagonal spacecraft bus */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, 0.068, 8]} />
        <meshStandardMaterial
          color="#1E2430"
          metalness={0.85}
          roughness={0.28}
        />
      </mesh>

      {/* Gold MLI thermal wrap */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 0.032, 8]} />
        <meshStandardMaterial
          color="#F59E0B"
          metalness={0.92}
          roughness={0.18}
          emissive="#D97706"
          emissiveIntensity={0.45}
        />
      </mesh>

      {/* Deployed twin solar wings */}
      {[-1, 1].map((dir) => (
        <group key={dir} position={[0, 0, dir * 0.038]}>
          <mesh
            position={[0, 0, dir * 0.11]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0025, 0.0025, 0.22, 6]} />
            <meshStandardMaterial
              color="#CBD5E1"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {[0, 1, 2].map((panelIdx) => (
            <mesh
              key={panelIdx}
              position={[0, 0, dir * (0.045 + panelIdx * 0.068)]}
            >
              <boxGeometry args={[0.052, 0.003, 0.06]} />
              <meshStandardMaterial
                color="#1E3A8A"
                metalness={0.75}
                roughness={0.25}
                emissive={solarColor}
                emissiveIntensity={0.55}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Nadir optical / SAR aperture */}
      <mesh position={[-0.032, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.018, 0.02, 10]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={2.5}
        />
      </mesh>

      {/* Volumetric Nadir Swath Scan Cone */}
      <mesh position={[-beamLen * 0.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.095, beamLen, 16, 1, true]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Nadir laser boresight filament */}
      <mesh position={[-beamLen * 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0018, 0.0018, beamLen, 6]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Projected Ground-Track Swath Ring on the planet surface */}
      <mesh position={[-beamLen, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.078, 0.096, 6]} />
        <meshBasicMaterial
          color={accentColor}
          side={THREE.DoubleSide}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Spacecraft navigation strobe */}
      <mesh position={[0.036, 0, 0]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

const PACKET_POS = new THREE.Vector3();

export default function GeospatialGlobe({
  position = [0, 0, 0],
  scale = 1,
}: GeospatialGlobeProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const globeSpinRef = useRef<THREE.Group>(null!);
  const bezelRingRef = useRef<THREE.Group>(null!);
  const caliperARef = useRef<THREE.Mesh>(null!);
  const caliperBRef = useRef<THREE.Mesh>(null!);
  const satOrbit1Ref = useRef<THREE.Group>(null!);
  const satOrbit2Ref = useRef<THREE.Group>(null!);
  const satOrbit3Ref = useRef<THREE.Group>(null!);
  const baseRingsRef = useRef<THREE.Group>(null!);

  const arcPacketRefs = useRef<THREE.Mesh[]>([]);
  const arcTrailRefs = useRef<THREE.Mesh[]>([]);

  const SUN_VECTOR = useMemo(() => sceneSunVector(), []);

  const terrainMatrix = useMemo(
    () => buildTerrainDotMatrix(2.2, 0.25, 0.012, SUN_VECTOR),
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
  const indiaGisMeshSegments = useMemo(() => buildIndiaGisMesh(1.024), []);
  const worldCoastSegments = useMemo(
    () => buildWorldCoastlineSegments(1.007),
    []
  );

  const graticule = useMemo(() => buildGraticule(1.0), []);

  const tier1Cities = useMemo(
    () =>
      buildLandmarkMarkers([
        { lat: 23.02, lon: 72.57, color: "#FE6E00" }, // Ahmedabad HQ
        { lat: 21.25, lon: 81.62, color: "#38BDF8" }, // Raipur CSPDCL
        { lat: 48.85, lon: 2.35, color: "#FFB74D" }, // Paris (French Solar CAD)
        { lat: 1.35, lon: 103.82, color: "#10B981" }, // Singapore
        { lat: 25.2, lon: 55.27, color: "#FFB74D" }, // Dubai
      ]),
    []
  );

  const tier2Cities = useMemo(
    () =>
      buildLandmarkMarkers([
        { lat: 19.07, lon: 72.87, color: "#FFFFFF" }, // Mumbai
        { lat: 28.61, lon: 77.2, color: "#FFFFFF" }, // New Delhi
        { lat: 12.97, lon: 77.59, color: "#38BDF8" }, // Bengaluru
        { lat: 22.57, lon: 88.36, color: "#FFFFFF" }, // Kolkata
        { lat: 13.08, lon: 80.27, color: "#FFFFFF" }, // Chennai
        { lat: 17.38, lon: 78.48, color: "#FFFFFF" }, // Hyderabad
        { lat: 26.9, lon: 75.8, color: "#FFB74D" }, // Jaipur
        { lat: 22.3, lon: 73.18, color: "#FE6E00" }, // Vadodara
        { lat: 50.11, lon: 8.68, color: "#38BDF8" }, // Frankfurt
        { lat: 51.5, lon: -0.12, color: "#FFFFFF" }, // London
        { lat: 35.68, lon: 139.69, color: "#38BDF8" }, // Tokyo
      ]),
    []
  );

  const hubs: GisHubConfig[] = useMemo(
    () => [
      {
        id: "ahmedabad-hq",
        lat: 23.02,
        lon: 72.57,
        color: "#FE6E00",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.35,
        isPrimary: true,
      },
      {
        id: "raipur-cspdcl",
        lat: 21.25,
        lon: 81.62,
        color: "#38BDF8",
        coreColor: "#E0F2FE",
        pulseSpeed: 1.55,
      },
      {
        id: "paris-solar",
        lat: 48.85,
        lon: 2.35,
        color: "#FFB74D",
        coreColor: "#FFF3E0",
        pulseSpeed: 1.15,
      },
      {
        id: "singapore-cloud",
        lat: 1.35,
        lon: 103.82,
        color: "#10B981",
        coreColor: "#D1FAE5",
        pulseSpeed: 1.25,
      },
      {
        id: "dubai-mena",
        lat: 25.2,
        lon: 55.27,
        color: "#FFB74D",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.4,
      },
      {
        id: "bengaluru-tech",
        lat: 12.97,
        lon: 77.59,
        color: "#38BDF8",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.5,
      },
    ],
    []
  );

  const ARCS = useMemo(
    () => [
      {
        id: "hq-raipur",
        curve: buildGreatCircleArc(23.02, 72.57, 21.25, 81.62, 1.02, 0.14),
        color: "#FE6E00",
        packets: 2,
        speed: 0.65,
      },
      {
        id: "hq-paris",
        curve: buildGreatCircleArc(23.02, 72.57, 48.85, 2.35, 1.02, 0.36),
        color: "#FFB74D",
        packets: 3,
        speed: 0.38,
      },
      {
        id: "hq-singapore",
        curve: buildGreatCircleArc(23.02, 72.57, 1.35, 103.82, 1.02, 0.24),
        color: "#10B981",
        packets: 2,
        speed: 0.48,
      },
      {
        id: "hq-dubai",
        curve: buildGreatCircleArc(23.02, 72.57, 25.2, 55.27, 1.02, 0.16),
        color: "#FFB74D",
        packets: 2,
        speed: 0.58,
      },
      {
        id: "hq-bengaluru",
        curve: buildGreatCircleArc(23.02, 72.57, 12.97, 77.59, 1.02, 0.12),
        color: "#38BDF8",
        packets: 2,
        speed: 0.72,
      },
      {
        id: "hq-delhi",
        curve: buildGreatCircleArc(23.02, 72.57, 28.61, 77.2, 1.02, 0.1),
        color: "#FE6E00",
        packets: 2,
        speed: 0.78,
      },
    ],
    []
  );

  const arcTubes = useMemo(
    () =>
      ARCS.map(
        (a) => new THREE.TubeGeometry(a.curve, 32, 0.0042, 6, false)
      ),
    [ARCS]
  );

  const coreMaterial = useMemo(
    () => createGlobeCoreMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );
  const atmosphereMaterial = useMemo(
    () => createAtmosphereMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );
  const dotMaterial = useMemo(
    () => createTerrainDotMatrixMaterial({ size: 0.036, opacity: 0.96 }),
    []
  );
  const landmarkMaterial = useMemo(() => createLandmarkMaterial(0.115), []);
  const landmarkSecondaryMaterial = useMemo(
    () => createLandmarkMaterial(0.072),
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
  const tropicMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#FE6E00", opacity: 0.62 }),
    []
  );
  const worldCoastMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.58 }),
    []
  );
  const indiaCoastMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#FE6E00", opacity: 0.98 }),
    []
  );
  const indiaElevatedMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#FFB74D", opacity: 0.72 }),
    []
  );
  const indiaMeshMaterial = useMemo(
    () => createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.68 }),
    []
  );

  useEffect(
    () => () => {
      coreMaterial.dispose();
      atmosphereMaterial.dispose();
      dotMaterial.dispose();
      landmarkMaterial.dispose();
      landmarkSecondaryMaterial.dispose();
      graticuleMaterial.dispose();
      equatorMaterial.dispose();
      tropicMaterial.dispose();
      worldCoastMaterial.dispose();
      indiaCoastMaterial.dispose();
      indiaElevatedMaterial.dispose();
      indiaMeshMaterial.dispose();
      arcTubes.forEach((g) => g.dispose());
    },
    [
      coreMaterial,
      atmosphereMaterial,
      dotMaterial,
      landmarkMaterial,
      landmarkSecondaryMaterial,
      graticuleMaterial,
      equatorMaterial,
      tropicMaterial,
      worldCoastMaterial,
      indiaCoastMaterial,
      indiaElevatedMaterial,
      indiaMeshMaterial,
      arcTubes,
    ]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (globeSpinRef.current) {
      globeSpinRef.current.rotation.y = 3.02 + Math.sin(t * 0.26) * 0.18;
      globeSpinRef.current.rotation.x = 0.28 + Math.cos(t * 0.2) * 0.04;
    }

    syncDotMatrixScale(dotMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(landmarkMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(
      landmarkSecondaryMaterial,
      state.size.height,
      state.viewport.dpr
    );

    if (coreMaterial.uniforms?.uTime) {
      coreMaterial.uniforms.uTime.value = t;
    }
    if (landmarkMaterial.uniforms?.uTime) {
      landmarkMaterial.uniforms.uTime.value = t;
    }
    if (landmarkSecondaryMaterial.uniforms?.uTime) {
      landmarkSecondaryMaterial.uniforms.uTime.value = t * 0.7 + 1.3;
    }

    if (bezelRingRef.current) {
      bezelRingRef.current.rotation.y = t * 0.06;
    }
    if (caliperARef.current) {
      caliperARef.current.rotation.z = t * 0.32;
    }
    if (caliperBRef.current) {
      caliperBRef.current.rotation.z = -t * 0.24 + 1.2;
    }

    if (satOrbit1Ref.current) {
      satOrbit1Ref.current.rotation.z = t * 0.38 + 0.6;
    }
    if (satOrbit2Ref.current) {
      satOrbit2Ref.current.rotation.z = -t * 0.29 + 2.4;
    }
    if (satOrbit3Ref.current) {
      satOrbit3Ref.current.rotation.z = t * 0.22 + 4.1;
    }

    if (baseRingsRef.current) {
      baseRingsRef.current.rotation.z = -t * 0.15;
    }

    ARCS.forEach((arc, ai) => {
      for (let i = 0; i < arc.packets; i++) {
        const u = (t * arc.speed + ai * 0.21 + i / arc.packets) % 1;
        const pkt = arcPacketRefs.current[ai * 4 + i];
        if (pkt) {
          arc.curve.getPoint(u, PACKET_POS);
          pkt.position.copy(PACKET_POS);
        }
        const trail = arcTrailRefs.current[ai * 4 + i];
        if (trail) {
          arc.curve.getPoint((u - 0.045 + 1) % 1, PACKET_POS);
          trail.position.copy(PACKET_POS);
        }
      }
    });

    if (rootGroupRef.current) {
      const targetRotY = state.pointer.x * 0.24;
      const targetRotX = -state.pointer.y * 0.16;
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
      {/* =====================================================================
          1. PLANETARY GIS SPHERE (CONTINENTS, TOPOGRAPHY, HUBS & ARCS)
      ===================================================================== */}
      <group ref={globeSpinRef} rotation={[0.28, 3.02, 0]}>
        <mesh material={coreMaterial}>
          <sphereGeometry args={[0.988, 48, 48]} />
        </mesh>

        <mesh material={atmosphereMaterial}>
          <sphereGeometry args={[1.055, 48, 48]} />
        </mesh>

        {/* 15-Degree Survey Graticule */}
        <lineSegments material={graticuleMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.standard, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        {/* Equator & Prime/75°E Meridian Reference Lines */}
        <lineSegments material={equatorMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.equator, 3]}
            />
          </bufferGeometry>
        </lineSegments>
        <lineSegments material={equatorMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.primeMeridian, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        {/* Tropic of Cancer */}
        <lineSegments material={tropicMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.tropicOfCancer, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        {/* Global Continental Vector Coastlines */}
        <lineSegments material={worldCoastMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[worldCoastSegments, 3]}
            />
          </bufferGeometry>
        </lineSegments>

        {/* India Primary Vector Coastline, Elevated Hologram & Triangulated GIS Mesh */}
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

        {/* Continental & India Topographic Dot Matrix */}
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

        {/* Tier-1 & Tier-2 City Gazetteer Pins */}
        <points material={landmarkMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[tier1Cities.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[tier1Cities.colors, 3]}
            />
          </bufferGeometry>
        </points>
        <points material={landmarkSecondaryMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[tier2Cities.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[tier2Cities.colors, 3]}
            />
          </bufferGeometry>
        </points>

        {/* Surface GIS Command Hubs */}
        {hubs.map((hub) => (
          <GisSurfaceHub key={hub.id} hub={hub} globeRadius={1.018} />
        ))}

        {/* Geodesic Telemetry Links & Photon Riders */}
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
                    arcTrailRefs.current[ai * 4 + i] = el as THREE.Mesh;
                  }}
                >
                  <sphereGeometry args={[0.009, 8, 8]} />
                  <meshBasicMaterial
                    color={arc.color}
                    transparent
                    opacity={0.45}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    arcPacketRefs.current[ai * 4 + i] = el as THREE.Mesh;
                  }}
                >
                  <sphereGeometry args={[0.014, 10, 10]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </group>

      {/* =====================================================================
          2. ARCHITECTURAL OBSERVATORY GIMBAL & EQUATORIAL ASTROLABE BEZEL
      ===================================================================== */}
      <group rotation={[0.16, 0.12, -0.18]}>
        <group ref={bezelRingRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.19, 0.011, 8, 96]} />
            <meshStandardMaterial
              color="#222936"
              metalness={0.88}
              roughness={0.26}
            />
          </mesh>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.16, 0.0035, 6, 96]} />
            <meshBasicMaterial color="#FE6E00" transparent opacity={0.65} />
          </mesh>

          {Array.from({ length: 72 }, (_, i) => {
            const angle = (i / 72) * Math.PI * 2;
            const isMajor = i % 6 === 0;
            const isCardinal = i % 18 === 0;
            const tickLen = isCardinal ? 0.065 : isMajor ? 0.038 : 0.018;
            const r = 1.19 + tickLen * 0.5;
            return (
              <mesh
                key={`az-tick-${i}`}
                position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
                rotation={[0, -angle, 0]}
              >
                <boxGeometry
                  args={[
                    tickLen,
                    isCardinal ? 0.012 : 0.006,
                    isCardinal ? 0.014 : 0.006,
                  ]}
                />
                <meshBasicMaterial
                  color={
                    isCardinal
                      ? "#FE6E00"
                      : isMajor
                      ? "#FFB74D"
                      : "#64748B"
                  }
                  transparent
                  opacity={isCardinal ? 0.95 : isMajor ? 0.75 : 0.4}
                />
              </mesh>
            );
          })}

          <mesh ref={caliperARef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.215, 0.006, 6, 48, Math.PI * 0.38]} />
            <meshBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.75}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={caliperBRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.215, 0.005, 6, 48, Math.PI * 0.28]} />
            <meshBasicMaterial
              color="#FE6E00"
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* Meridional Gimbal Ring & Polar Trunnion Spindles */}
        <mesh>
          <torusGeometry args={[1.25, 0.008, 8, 96]} />
          <meshStandardMaterial
            color="#2B3444"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[1.235, 0.0025, 6, 96]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.35} />
        </mesh>

        {[1, -1].map((pole) => (
          <group key={`pole-${pole}`} position={[0, pole * 1.12, 0]}>
            <mesh>
              <cylinderGeometry args={[0.048, 0.062, 0.09, 12]} />
              <meshStandardMaterial
                color="#1E2530"
                metalness={0.9}
                roughness={0.22}
              />
            </mesh>
            <mesh position={[0, pole * 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.056, 0.006, 6, 20]} />
              <meshBasicMaterial color={pole > 0 ? "#FE6E00" : "#38BDF8"} />
            </mesh>
            <mesh position={[0, pole * 0.09, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.24, 8]} />
              <meshStandardMaterial
                color="#94A3B8"
                metalness={0.92}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, -pole * 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.11, 0.135, 24]} />
              <meshBasicMaterial
                color={pole > 0 ? "#FE6E00" : "#38BDF8"}
                side={THREE.DoubleSide}
                transparent
                opacity={0.45}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* =====================================================================
          3. THREE-SATELLITE ORBITAL CONSTELLATION (WITH NADIR GROUND TRACKS)
      ===================================================================== */}
      <group ref={satOrbit1Ref} rotation={[0.52, 0.25, 0.65]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.34, 0.0022, 6, 96]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.38} />
        </mesh>
        <OrbitalSatelliteUnit
          radius={1.34}
          accentColor="#FE6E00"
          solarColor="#38BDF8"
        />
      </group>

      <group ref={satOrbit2Ref} rotation={[-0.44, -0.35, -0.52]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.42, 0.002, 6, 96]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.32} />
        </mesh>
        <OrbitalSatelliteUnit
          radius={1.42}
          accentColor="#38BDF8"
          solarColor="#2563EB"
        />
      </group>

      <group ref={satOrbit3Ref} rotation={[0.18, 0.6, 0.12]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.49, 0.0018, 6, 96]} />
          <meshBasicMaterial color="#FFB74D" transparent opacity={0.24} />
        </mesh>
        <OrbitalSatelliteUnit
          radius={1.49}
          accentColor="#FFB74D"
          solarColor="#0284C7"
        />
      </group>

      {/* =====================================================================
          4. SUB-ORBITAL HOLOGRAPHIC PROJECTION PEDESTAL
      ===================================================================== */}
      <group
        ref={baseRingsRef}
        position={[0, -1.36, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <mesh>
          <ringGeometry args={[0.52, 0.55, 48]} />
          <meshBasicMaterial
            color="#FE6E00"
            side={THREE.DoubleSide}
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <ringGeometry args={[0.78, 0.8, 64]} />
          <meshBasicMaterial
            color="#38BDF8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.26}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={`ped-tick-${i}`}
              position={[Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[0.18, 0.006, 0.004]} />
              <meshBasicMaterial color="#FFB74D" transparent opacity={0.35} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
