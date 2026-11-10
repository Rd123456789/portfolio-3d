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
  advanceClock,
  createAtmosphereMaterial,
  createFlowLineMaterial,
  createGlobeCoreMaterial,
  createGlobeGridLineMaterial,
  createLandMaskTexture,
  createTerrainDotMatrixMaterial,
  createLandmarkMaterial,
  setUniform,
  syncDotMatrixScale,
  type TimeUniform,
} from "@/lib/shaders";

interface GeospatialGlobeProps {
  position?: [number, number, number];
  scale?: number;
  /** Lighter build for phones: coarser dot matrix, two satellites, fewer segments. */
  lite?: boolean;
}

const CORE_RADIUS = 0.988;
const ATMOSPHERE_RADIUS = 1.12;

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
  const beaconRef = useRef<THREE.Mesh>(null!);

  const { position, quaternion } = useMemo(() => {
    const pos = latLonToVector3(hub.lat, hub.lon, globeRadius);
    const normal = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );
    return { position: pos, quaternion: quat };
  }, [hub.lat, hub.lon, globeRadius]);

  const reach = hub.isPrimary ? 3.6 : 2.6;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const pulse = (ring: THREE.Mesh | null, phase: number, peak: number) => {
      if (!ring) return;
      const p = (t * hub.pulseSpeed * 0.5 + phase) % 1;
      const eased = 1 - (1 - p) * (1 - p);
      ring.scale.setScalar(1 + eased * reach);
      (ring.material as THREE.MeshBasicMaterial).opacity =
        peak * (1 - p) * (1 - p);
    };
    pulse(waveRingRef.current, 0, 0.9);
    pulse(outerWaveRef.current, 0.5, 0.7);
    if (beaconRef.current) beaconRef.current.rotation.y = t * 1.4;
  });

  const baseRadius = hub.isPrimary ? 0.028 : 0.019;
  const mastHeight = hub.isPrimary ? 0.13 : 0.08;

  return (
    <group position={position} quaternion={quaternion}>
      {/* Survey marker: crisp locator ring with a solid datum point */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.78, baseRadius, 28]} />
        <meshBasicMaterial color={hub.color} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[baseRadius * 0.34, 16]} />
        <meshBasicMaterial color={hub.coreColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Two staggered sonar pings easing out across the surface */}
      <mesh ref={waveRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRadius * 0.9, baseRadius, 28]} />
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
        <ringGeometry args={[baseRadius * 0.9, baseRadius, 28]} />
        <meshBasicMaterial
          color={hub.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Hairline telemetry mast and its beacon */}
      <mesh position={[0, mastHeight * 0.5, 0]}>
        <cylinderGeometry args={[0.0016, 0.0016, mastHeight, 5]} />
        <meshBasicMaterial color={hub.coreColor} transparent opacity={0.85} />
      </mesh>
      <mesh ref={beaconRef} position={[0, mastHeight + 0.012, 0]}>
        <octahedronGeometry args={[hub.isPrimary ? 0.013 : 0.009, 0]} />
        <meshBasicMaterial color={hub.isPrimary ? "#FFFFFF" : hub.color} />
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

const HUBS: GisHubConfig[] = [
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
];

// Telemetry links fanning out of the Ahmedabad HQ: [lat, lon, lift, colour, speed]
const ARC_ROUTES: [number, number, number, string, number][] = [
  [21.25, 81.62, 0.1, "#FE6E00", 0.62], // Raipur
  [48.85, 2.35, 0.22, "#FFB74D", 0.3], // Paris
  [1.35, 103.82, 0.22, "#10B981", 0.4], // Singapore
  [25.2, 55.27, 0.14, "#FFB74D", 0.5], // Dubai
  [12.97, 77.59, 0.09, "#38BDF8", 0.66], // Bengaluru
  [28.61, 77.2, 0.08, "#FE6E00", 0.7], // Delhi
];

// Secondary cities shown as gazetteer pins (primary ones carry a full hub)
const CITY_PINS = [
  { lat: 19.07, lon: 72.87, color: "#FFFFFF" }, // Mumbai
  { lat: 28.61, lon: 77.2, color: "#FFFFFF" }, // New Delhi
  { lat: 22.57, lon: 88.36, color: "#FFFFFF" }, // Kolkata
  { lat: 13.08, lon: 80.27, color: "#FFFFFF" }, // Chennai
  { lat: 17.38, lon: 78.48, color: "#FFFFFF" }, // Hyderabad
  { lat: 26.9, lon: 75.8, color: "#FFB74D" }, // Jaipur
  { lat: 22.3, lon: 73.18, color: "#FE6E00" }, // Vadodara
  { lat: 50.11, lon: 8.68, color: "#38BDF8" }, // Frankfurt
  { lat: 51.5, lon: -0.12, color: "#FFFFFF" }, // London
  { lat: 35.68, lon: 139.69, color: "#38BDF8" }, // Tokyo
];

/** Azimuth scale for the bezel: 72 graduations as one line-segment batch. */
function buildBezelTicks(radius: number): {
  positions: Float32Array;
  colors: Float32Array;
} {
  const positions: number[] = [];
  const colors: number[] = [];
  const cardinal = new THREE.Color("#FE6E00");
  const major = new THREE.Color("#FFB74D");
  const minor = new THREE.Color("#5B6B80");

  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const isCardinal = i % 18 === 0;
    const isMajor = i % 6 === 0;
    const length = isCardinal ? 0.07 : isMajor ? 0.042 : 0.02;
    const c = isCardinal ? cardinal : isMajor ? major : minor;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(
      cos * radius,
      0,
      sin * radius,
      cos * (radius + length),
      0,
      sin * (radius + length)
    );
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  };
}

export default function GeospatialGlobe({
  position = [0, 0, 0],
  scale = 1,
  lite = false,
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

  const sphereSegments = lite ? 48 : 72;
  const ringSegments = lite ? 72 : 128;

  const sun = useMemo(() => sceneSunVector(), []);
  const clock = useMemo<TimeUniform>(() => ({ value: 0 }), []);

  const terrainMatrix = useMemo(
    () => buildTerrainDotMatrix(lite ? 1.9 : 1.45, 0.012),
    [lite]
  );
  const indiaCoastSegments = useMemo(
    () => buildIndiaCoastlineSegments(1.018),
    []
  );
  const indiaElevatedSegments = useMemo(
    () => buildIndiaCoastlineSegments(1.034),
    []
  );
  const indiaGisMeshSegments = useMemo(() => buildIndiaGisMesh(1.024), []);
  const worldCoastSegments = useMemo(
    () => buildWorldCoastlineSegments(1.005),
    []
  );
  const graticule = useMemo(() => buildGraticule(1.0), []);
  const cityPins = useMemo(() => buildLandmarkMarkers(CITY_PINS), []);
  const bezelTicks = useMemo(() => buildBezelTicks(1.19), []);

  const arcs = useMemo(
    () =>
      ARC_ROUTES.map(([lat, lon, lift, color, speed], i) => {
        const curve = buildGreatCircleArc(23.02, 72.57, lat, lon, 1.02, lift);
        return {
          id: `arc-${i}`,
          geometry: new THREE.TubeGeometry(curve, 48, 0.004, 6, false),
          material: createFlowLineMaterial({
            color,
            time: clock,
            speed,
            pulses: 1,
            offset: i * 0.37,
            base: 0.72,
            fadeStart: 0.03,
            fadeEnd: 0.03,
          }),
        };
      }),
    [clock]
  );

  const landMask = useMemo(() => createLandMaskTexture(), []);
  const coreMaterial = useMemo(
    () => createGlobeCoreMaterial(sun, landMask),
    [sun, landMask]
  );
  const atmosphereMaterial = useMemo(
    () => createAtmosphereMaterial(sun, CORE_RADIUS, ATMOSPHERE_RADIUS),
    [sun]
  );
  const dotMaterial = useMemo(
    () => createTerrainDotMatrixMaterial({ size: 0.028, opacity: 0.9, sun }),
    [sun]
  );
  const pinMaterial = useMemo(() => createLandmarkMaterial(0.07), []);

  const lineMaterials = useMemo(
    () => ({
      graticule: createGlobeGridLineMaterial({ color: "#3B4A60", opacity: 0.3 }),
      equator: createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.42 }),
      tropic: createGlobeGridLineMaterial({ color: "#FE6E00", opacity: 0.5 }),
      worldCoast: createGlobeGridLineMaterial({ color: "#7CC4EE", opacity: 0.62 }),
      indiaCoast: createGlobeGridLineMaterial({ color: "#FE6E00", opacity: 1 }),
      indiaElevated: createGlobeGridLineMaterial({ color: "#FFB74D", opacity: 0.6 }),
      indiaMesh: createGlobeGridLineMaterial({ color: "#38BDF8", opacity: 0.55 }),
    }),
    []
  );

  useEffect(
    () => () => {
      landMask.dispose();
      coreMaterial.dispose();
      atmosphereMaterial.dispose();
      dotMaterial.dispose();
      pinMaterial.dispose();
      Object.values(lineMaterials).forEach((m) => m.dispose());
      arcs.forEach((arc) => {
        arc.geometry.dispose();
        arc.material.dispose();
      });
    },
    [
      landMask,
      coreMaterial,
      atmosphereMaterial,
      dotMaterial,
      pinMaterial,
      lineMaterials,
      arcs,
    ]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    advanceClock(clock, t);

    // Slow survey drift that always keeps India on the facing hemisphere
    if (globeSpinRef.current) {
      globeSpinRef.current.rotation.y = 3.16 + Math.sin(t * 0.26) * 0.18;
      globeSpinRef.current.rotation.x = 0.28 + Math.cos(t * 0.2) * 0.04;
    }

    syncDotMatrixScale(dotMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(pinMaterial, state.size.height, state.viewport.dpr);
    setUniform(coreMaterial, "uTime", t);
    setUniform(pinMaterial, "uTime", t);

    if (bezelRingRef.current) bezelRingRef.current.rotation.y = t * 0.06;
    if (caliperARef.current) caliperARef.current.rotation.z = t * 0.32;
    if (caliperBRef.current) caliperBRef.current.rotation.z = -t * 0.24 + 1.2;

    if (satOrbit1Ref.current) satOrbit1Ref.current.rotation.z = t * 0.38 + 0.6;
    if (satOrbit2Ref.current) satOrbit2Ref.current.rotation.z = -t * 0.29 + 2.4;
    if (satOrbit3Ref.current) satOrbit3Ref.current.rotation.z = t * 0.22 + 4.1;

    if (baseRingsRef.current) baseRingsRef.current.rotation.z = -t * 0.15;

    if (rootGroupRef.current) {
      rootGroupRef.current.rotation.y = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.y,
        state.pointer.x * 0.24,
        4,
        delta
      );
      rootGroupRef.current.rotation.x = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.x,
        -state.pointer.y * 0.16,
        4,
        delta
      );
    }
  });

  const surfaceLines: [string, Float32Array, THREE.ShaderMaterial][] = [
    ["graticule", graticule.standard, lineMaterials.graticule],
    ["equator", graticule.equator, lineMaterials.equator],
    ["prime-meridian", graticule.primeMeridian, lineMaterials.equator],
    ["tropic", graticule.tropicOfCancer, lineMaterials.tropic],
    ["world-coast", worldCoastSegments, lineMaterials.worldCoast],
    ["india-coast", indiaCoastSegments, lineMaterials.indiaCoast],
    ["india-elevated", indiaElevatedSegments, lineMaterials.indiaElevated],
    ["india-mesh", indiaGisMeshSegments, lineMaterials.indiaMesh],
  ];

  return (
    <group ref={rootGroupRef} position={position} scale={scale}>
      {/* =====================================================================
          1. PLANETARY GIS SPHERE (CONTINENTS, TOPOGRAPHY, HUBS & ARCS)
      ===================================================================== */}
      <group ref={globeSpinRef} rotation={[0.28, 3.16, 0]}>
        <mesh material={coreMaterial}>
          <sphereGeometry args={[CORE_RADIUS, sphereSegments, sphereSegments]} />
        </mesh>

        {/* Graticule, real-world coastlines, India outline + elevated hologram */}
        {surfaceLines.map(([key, positions, material]) => (
          <lineSegments key={key} material={material}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[positions, 3]}
              />
            </bufferGeometry>
          </lineSegments>
        ))}

        {/* Continental & India Topographic Dot Matrix */}
        <points key={`dots-${lite}`} material={dotMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[terrainMatrix.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[terrainMatrix.colors, 3]}
            />
            <bufferAttribute
              attach="attributes-aSize"
              args={[terrainMatrix.sizes, 1]}
            />
          </bufferGeometry>
        </points>

        {/* City Gazetteer Pins */}
        <points material={pinMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[cityPins.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[cityPins.colors, 3]}
            />
          </bufferGeometry>
        </points>

        {/* Surface GIS Command Hubs */}
        {HUBS.map((hub) => (
          <GisSurfaceHub key={hub.id} hub={hub} globeRadius={1.018} />
        ))}

        {/* Geodesic Telemetry Links carrying comet pulses out of the HQ */}
        {arcs.map((arc) => (
          <mesh key={arc.id} geometry={arc.geometry} material={arc.material} />
        ))}
      </group>

      {/* Atmosphere halo stays fixed to the view so its lit side never spins */}
      <mesh material={atmosphereMaterial}>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, sphereSegments, sphereSegments]} />
      </mesh>

      {/* =====================================================================
          2. ARCHITECTURAL OBSERVATORY GIMBAL & EQUATORIAL ASTROLABE BEZEL
      ===================================================================== */}
      <group rotation={[0.4, 0.12, -0.16]}>
        <group ref={bezelRingRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.19, 0.0095, 10, ringSegments]} />
            <meshStandardMaterial
              color="#8E9BAD"
              metalness={1}
              roughness={0.24}
            />
          </mesh>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.168, 0.003, 6, ringSegments]} />
            <meshBasicMaterial color="#FE6E00" transparent opacity={0.7} />
          </mesh>

          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[bezelTicks.positions, 3]}
              />
              <bufferAttribute
                attach="attributes-color"
                args={[bezelTicks.colors, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial vertexColors transparent opacity={0.85} />
          </lineSegments>

          <mesh ref={caliperARef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.275, 0.005, 6, 48, Math.PI * 0.38]} />
            <meshBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.75}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={caliperBRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.275, 0.0045, 6, 48, Math.PI * 0.28]} />
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
          <torusGeometry args={[1.25, 0.0075, 10, ringSegments]} />
          <meshStandardMaterial
            color="#7C8898"
            metalness={1}
            roughness={0.3}
          />
        </mesh>

        {[1, -1].map((pole) => (
          <group key={`pole-${pole}`} position={[0, pole * 1.2, 0]}>
            <mesh>
              <cylinderGeometry
                args={pole > 0 ? [0.03, 0.05, 0.1, 20] : [0.05, 0.03, 0.1, 20]}
              />
              <meshStandardMaterial
                color="#3A4556"
                metalness={1}
                roughness={0.28}
              />
            </mesh>
            <mesh position={[0, -pole * 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.052, 0.005, 8, 28]} />
              <meshBasicMaterial color={pole > 0 ? "#FE6E00" : "#38BDF8"} />
            </mesh>
            <mesh position={[0, pole * 0.11, 0]}>
              <cylinderGeometry args={[0.011, 0.011, 0.16, 12]} />
              <meshStandardMaterial
                color="#C3CDD9"
                metalness={1}
                roughness={0.18}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* =====================================================================
          3. ORBITAL CONSTELLATION (WITH NADIR GROUND TRACKS)
      ===================================================================== */}
      <group ref={satOrbit1Ref} rotation={[0.52, 0.25, 0.65]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.34, 0.0018, 6, ringSegments]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.34} />
        </mesh>
        <OrbitalSatelliteUnit
          radius={1.34}
          accentColor="#FE6E00"
          solarColor="#38BDF8"
        />
      </group>

      <group ref={satOrbit2Ref} rotation={[-0.44, -0.35, -0.52]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.42, 0.0016, 6, ringSegments]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.28} />
        </mesh>
        <OrbitalSatelliteUnit
          radius={1.42}
          accentColor="#38BDF8"
          solarColor="#2563EB"
        />
      </group>

      {!lite && (
        <group ref={satOrbit3Ref} rotation={[0.18, 0.6, 0.12]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.49, 0.0014, 6, ringSegments]} />
            <meshBasicMaterial color="#FFB74D" transparent opacity={0.22} />
          </mesh>
          <OrbitalSatelliteUnit
            radius={1.49}
            accentColor="#FFB74D"
            solarColor="#0284C7"
          />
        </group>
      )}

      {/* =====================================================================
          4. SUB-ORBITAL HOLOGRAPHIC PROJECTION PEDESTAL
      ===================================================================== */}
      <group
        ref={baseRingsRef}
        position={[0, -1.4, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <mesh>
          <ringGeometry args={[0.53, 0.55, 64]} />
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
          <ringGeometry args={[0.79, 0.8, 80]} />
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
