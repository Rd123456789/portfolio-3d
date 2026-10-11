"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  latLonToVector3,
  buildTerrainDotMatrix,
  buildGreatCircleArc,
  buildLandmarkMarkers,
  indiaCoastlinePositions,
  INDIA_RINGS,
  buildGraticule,
  sceneSunVector,
} from "@/lib/geo";
import {
  createAtmosphereMaterial,
  createGlobeCoreMaterial,
  createTerrainDotMatrixMaterial,
  createLandmarkMaterial,
  createNightLightMaterial,
  syncDotMatrixScale,
} from "@/lib/shaders";

interface GeospatialGlobeProps {
  position?: [number, number, number];
  scale?: number;
}

interface GroundBeaconConfig {
  id: string;
  lat: number;
  lon: number;
  color: string;
  coreColor: string;
  pulseSpeed: number;
}

// Sleek flush surface radar beacon (zero clunky boxes, zero lollipop sticks, zero 3D text)
function GroundBeacon({  beacon,
  globeRadius,
}: {
  beacon: GroundBeaconConfig;
  globeRadius: number;
}) {
  const pingRing1Ref = useRef<THREE.Mesh>(null!);
  const shaftRef = useRef<THREE.Mesh>(null!);

  const { position, orientationQuat } = useMemo(() => {
    const pos = latLonToVector3(beacon.lat, beacon.lon, globeRadius);
    const n = pos.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      n
    );
    return { position: pos, orientationQuat: q };
  }, [beacon.lat, beacon.lon, globeRadius]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // A single radar wave expanding across the surface — two waves plus a
    // needle read as a gauge face rather than a ground station.
    if (pingRing1Ref.current) {
      const p1 = (t * beacon.pulseSpeed) % 1;
      const s1 = 1 + p1 * 3.6;
      pingRing1Ref.current.scale.set(s1, s1, s1);
      const mat1 = pingRing1Ref.current.material as THREE.MeshBasicMaterial;
      if (mat1) {
        mat1.opacity = Math.max(0, 0.9 * (1 - p1));
      }
    }

    // The light shaft breathes gently so the marker feels live
    if (shaftRef.current) {
      const mat = shaftRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.22 + Math.abs(Math.sin(t * 1.8 + beacon.lat)) * 0.2;
    }
  });

  return (
    <group position={position} quaternion={orientationQuat}>
      {/* Flush anchor disc, sitting exactly on the surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.012, 0.022, 20]} />
        <meshBasicMaterial color={beacon.color} side={THREE.DoubleSide} />
      </mesh>

      {/* Single expanding surface wave */}
      <mesh ref={pingRing1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.018, 0.03, 20]} />
        <meshBasicMaterial
          color={beacon.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Bright core, so the station still reads at a distance */}
      <mesh position={[0, 0.004, 0]}>
        <sphereGeometry args={[0.011, 8, 8]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Tapered light shaft rising off the surface, fading as it climbs */}
      <mesh ref={shaftRef} position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.002, 0.0052, 0.26, 6]} />
        <meshBasicMaterial
          color={beacon.color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Scratch vector reused by the arc riders — keeps the frame loop allocation-free.
const ARC_POSITION = new THREE.Vector3();

interface TelemetryArcProps {
  latA: number;
  lonA: number;
  latB: number;
  lonB: number;
  radius: number;
  lift: number;
  speed: number;
  offset: number;
  color: string;
  packetRadius?: number;
  tubeRadius?: number;
  /** How many photons ride this link; mirrors the link's real traffic class. */
  packets?: number;
  packetOffset?: number;
}

/**
 * One inter-hub telemetry link: a glowing tube along a great-circle arc carrying
 * `packets` photon riders, each leaving a fading comet trail.
 */
function TelemetryArc({
  latA,
  lonA,
  latB,
  lonB,
  radius,
  lift,
  speed,
  offset,
  color,
  packetRadius = 0.016,
  tubeRadius = 0.0035,
  packets = 3,
  packetOffset = 0,
}: TelemetryArcProps) {
  const packetRefs = useRef<THREE.Mesh[]>([]);
  const trail1Refs = useRef<THREE.Mesh[]>([]);
  const trail2Refs = useRef<THREE.Mesh[]>([]);

  const curve = useMemo(
    () => buildGreatCircleArc(latA, lonA, latB, lonB, radius, lift),
    [latA, lonA, latB, lonB, radius, lift]
  );

  const tubeGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 32, tubeRadius, 6, false),
    [curve, tubeRadius]
  );

  useEffect(() => () => tubeGeometry.dispose(), [tubeGeometry]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < packets; i++) {
      // Each photon carries an evenly spaced phase along the link
      const phase = packetOffset + i / packets + t * speed;
      const u = phase % 1;

      const p = packetRefs.current[i];
      if (p) {
        curve.getPoint(u, ARC_POSITION);
        p.position.copy(ARC_POSITION);
      }
      const t1 = trail1Refs.current[i];
      if (t1) {
        curve.getPoint((u - 0.035 + 1) % 1, ARC_POSITION);
        t1.position.copy(ARC_POSITION);
      }
      const t2 = trail2Refs.current[i];
      if (t2) {
        curve.getPoint((u - 0.08 + 1) % 1, ARC_POSITION);
        t2.position.copy(ARC_POSITION);
      }
    }
  });

  return (
    <>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {Array.from({ length: packets }, (_, i) => (
        <React.Fragment key={`pkt-${i}`}>
          <mesh
            ref={(el) => {
              trail2Refs.current[i] = el as THREE.Mesh;
            }}
          >
            <sphereGeometry args={[packetRadius * 0.5, 6, 6]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              trail1Refs.current[i] = el as THREE.Mesh;
            }}
          >
            <sphereGeometry args={[packetRadius * 0.78, 6, 6]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.45}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              packetRefs.current[i] = el as THREE.Mesh;
            }}
          >
            <sphereGeometry args={[packetRadius, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Orbiting telemetry satellite. Proportioned like real flight hardware: a small
 * cylindrical bus, long thin deployed solar arrays on a single axis, and a
 * high-gain dish pointed at the ground station. The orbit ring stays circular.
 */
function OrbitalSatellite({ orbitRadius = 1.42 }: { orbitRadius?: number }) {
  const orbitRef = useRef<THREE.Group>(null!);
  const wingRef = useRef<THREE.Group>(null!);
  const dishRef = useRef<THREE.Group>(null!);
  const strobeRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (orbitRef.current) {
      orbitRef.current.rotation.z += delta * 0.35;
      orbitRef.current.rotation.y = Math.sin(t * 0.3) * 0.12;
    }

    // Arrays rotate about their own long axis to keep the cells facing the sun
    if (wingRef.current) {
      wingRef.current.rotation.x = Math.sin(t * 0.35) * 0.3;
    }

    // The dish keeps tracking the ground station below
    if (dishRef.current) {
      dishRef.current.rotation.y = Math.sin(t * 0.22) * 0.2;
    }

    if (strobeRef.current) {
      const mat = strobeRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.sin(t * 5.5) > 0.55 ? 7 : 0.25;
    }
  });

  // Three cells per wing, each cell longer than it is wide
  const WING_PANELS = 3;
  const PANEL_LEN = 0.1;
  const PANEL_WIDTH = 0.1;
  const PANEL_THICKNESS = 0.007;

  return (
    <group rotation={[0.45, 0.2, 0.75]}>
      {/* Orbital path */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[orbitRadius, 0.002, 8, 64]} />
        <meshBasicMaterial color="#FE6E00" transparent opacity={0.3} />
      </mesh>

      <group ref={orbitRef}>
        <group position={[orbitRadius, 0, 0]}>
          {/* --- Deployed solar arrays ---
              Two long wings that extend along the orbit normal, so their full
              span crosses the view instead of foreshortening down the camera
              axis, and they never sweep across the planet behind them. */}
          <group ref={wingRef}>
            {[-1, 1].map((dir) => (
              <group key={dir} position={[0, dir * 0.05, 0]}>
                {/* Deploy boom */}
                <mesh position={[0, dir * 0.03, 0]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
                  <meshStandardMaterial
                    color="#C9C9C9"
                    metalness={0.9}
                    roughness={0.3}
                  />
                </mesh>
                {Array.from({ length: WING_PANELS }, (_, i) => (
                  <mesh
                    key={i}
                    position={[0, dir * (0.06 + i * PANEL_LEN + PANEL_LEN / 2), 0]}
                  >
                    <boxGeometry
                      args={[PANEL_WIDTH, PANEL_LEN * 0.94, PANEL_THICKNESS]}
                    />
                    {/* Dark blue photovoltaic cells with a faint self-glow */}
                    <meshStandardMaterial
                      color="#22406E"
                      metalness={0.6}
                      roughness={0.35}
                      emissive="#3B6FE2"
                      emissiveIntensity={0.55}
                    />
                  </mesh>
                ))}
              </group>
            ))}
          </group>

          {/* --- Central bus: axis along the orbit normal (Y) --- */}
          <mesh>
            <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
            <meshStandardMaterial
              color="#2A2A2A"
              metalness={0.9}
              roughness={0.3}
            />
          </mesh>
          {/* Gold MLI thermal blanket band */}
          <mesh>
            <cylinderGeometry args={[0.052, 0.052, 0.044, 8]} />
            <meshStandardMaterial
              color="#FFB74D"
              metalness={0.9}
              roughness={0.15}
              emissive="#FFB74D"
              emissiveIntensity={0.45}
            />
          </mesh>

          {/* --- High-gain dish, boresighted inward at Earth --- */}
          <group ref={dishRef} position={[-0.062, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.048, 0.036, 12, 1, true]} />
              <meshStandardMaterial
                color="#D2D2D2"
                metalness={0.9}
                roughness={0.25}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[-0.022, 0, 0]}>
              <sphereGeometry args={[0.007, 6, 6]} />
              <meshStandardMaterial
                color="#FE6E00"
                emissive="#FE6E00"
                emissiveIntensity={3}
              />
            </mesh>
          </group>

          {/* --- Nadir instrument aperture, also facing Earth --- */}
          <mesh position={[0.055, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, 0.022, 10]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={2.5}
            />
          </mesh>

          {/* --- Aviation strobe on the anti-Earth face --- */}
          <mesh ref={strobeRef} position={[0, 0, 0.055]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#FE6E00"
              emissiveIntensity={4}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default function GeospatialGlobe({
  position = [0, 0, 0],
  scale = 1,
}: GeospatialGlobeProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const globeInnerRef = useRef<THREE.Group>(null!);
  const satellite1Ref = useRef<THREE.Group>(null!);
  const satellite2Ref = useRef<THREE.Group>(null!);

  // Sun vector for the true sub-solar point at the current wall-clock time, so
  // the terminator, the night lights and the relief shading all agree.
  const SUN_VECTOR = useMemo(() => sceneSunVector(new Date()), []);

  // High-Density Continental Dot Matrix with real radial relief: elevation is
  // baked into the vertex positions, so the Himalaya pokes out of the sphere.
  const terrainMatrix = useMemo(
    () => buildTerrainDotMatrix(2.8, 0.12, 0.014, SUN_VECTOR),
    [SUN_VECTOR]
  );
  const pointPositions = terrainMatrix.positions;
  const pointColors = terrainMatrix.colors;

  // Named city landmarks. Landmark pins encode a tier: capital/primary metros
  // get a larger pin with a slow sweep, secondary cities a small steady dot —
  // the same hierarchy a real cartographic gazetteer uses.
  const landmarkMarkers = useMemo(() => {
    const cityList: { lat: number; lon: number; color: string; tier: 1 | 2 }[] = [
      // Tier 1 — the story poles
      { lat: 23.02, lon: 72.57, color: "#FFB74D", tier: 1 }, // Ahmedabad
      { lat: 21.25, lon: 81.62, color: "#FFB74D", tier: 1 }, // Raipur
      { lat: 26.9, lon: 75.8, color: "#FE6E00", tier: 1 }, // Jaipur
      { lat: 1.35, lon: 103.82, color: "#38BDF8", tier: 1 }, // Singapore
      { lat: 50.11, lon: 8.68, color: "#38BDF8", tier: 1 }, // Frankfurt
      // Tier 2 — major metros
      { lat: 19.07, lon: 72.87, color: "#FFFFFF", tier: 2 }, // Mumbai
      { lat: 28.61, lon: 77.2, color: "#FFFFFF", tier: 2 }, // Delhi
      { lat: 12.97, lon: 77.59, color: "#FFFFFF", tier: 2 }, // Bengaluru
      { lat: 13.08, lon: 80.27, color: "#FFFFFF", tier: 2 }, // Chennai
      { lat: 22.57, lon: 88.36, color: "#FFFFFF", tier: 2 }, // Kolkata
      { lat: 17.38, lon: 78.48, color: "#FFFFFF", tier: 2 }, // Hyderabad
      { lat: 18.52, lon: 73.85, color: "#FFFFFF", tier: 2 }, // Pune
      { lat: 25.59, lon: 85.13, color: "#FFFFFF", tier: 2 }, // Patna
      { lat: 25.2, lon: 55.27, color: "#38BDF8", tier: 2 }, // Dubai
      { lat: 51.5, lon: -0.12, color: "#38BDF8", tier: 2 }, // London
      { lat: 40.71, lon: -74.0, color: "#38BDF8", tier: 2 }, // New York
      { lat: 37.77, lon: -122.42, color: "#38BDF8", tier: 2 }, // San Francisco
    ];
    return cityList;
  }, []);

  // Tier-1 pins render larger with a sweeping halo; tier-2 are small steady dots.
  const tier1Markers = useMemo(
    () =>
      buildLandmarkMarkers(
        landmarkMarkers.filter((c) => c.tier === 1)
      ),
    [landmarkMarkers]
  );
  const tier2Markers = useMemo(
    () =>
      buildLandmarkMarkers(
        landmarkMarkers.filter((c) => c.tier === 2)
      ),
    [landmarkMarkers]
  );

  // Night-side urban glow. Real city populations drive both the light radius and
  // its intensity, so dark-side sprawl reads like actual population density.
  const nightLights = useMemo(() => {
    const cities: { lat: number; lon: number; pop: number }[] = [
      { lat: 28.61, lon: 77.2, pop: 32.9 }, // Delhi NCR
      { lat: 19.07, lon: 72.87, pop: 21.7 }, // Mumbai
      { lat: 22.57, lon: 88.36, pop: 15.3 }, // Kolkata
      { lat: 12.97, lon: 77.59, pop: 13.6 }, // Bengaluru
      { lat: 13.08, lon: 80.27, pop: 11.5 }, // Chennai
      { lat: 23.02, lon: 72.57, pop: 8.4 }, // Ahmedabad
      { lat: 17.38, lon: 78.48, pop: 10.5 }, // Hyderabad
      { lat: 18.52, lon: 73.85, pop: 7.4 }, // Pune
      { lat: 26.9, lon: 75.8, pop: 4.0 }, // Jaipur
      { lat: 22.0, lon: 79.0, pop: 2.5 }, // Nagpur
      { lat: 25.59, lon: 85.13, pop: 2.6 }, // Patna
      { lat: 21.25, lon: 81.62, pop: 1.4 }, // Raipur
      { lat: 40.71, lon: -74.0, pop: 18.8 }, // New York
      { lat: 34.0, lon: -118.2, pop: 12.5 }, // Los Angeles
      { lat: 51.5, lon: -0.12, pop: 9.6 }, // London
      { lat: 48.85, lon: 2.35, pop: 11.2 }, // Paris
      { lat: 35.68, lon: 139.69, pop: 37.2 }, // Tokyo
      { lat: 31.23, lon: 121.47, pop: 28.5 }, // Shanghai
      { lat: -23.55, lon: -46.63, pop: 22.4 }, // Sao Paulo
      { lat: -33.86, lon: 151.2, pop: 5.3 }, // Sydney
      { lat: 25.2, lon: 55.27, pop: 3.5 }, // Dubai
      { lat: 1.35, lon: 103.82, pop: 6.0 }, // Singapore
    ];

    const coords: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const warm = new THREE.Color("#FFD9A0");
    const c = new THREE.Color();

    for (const city of cities) {
      const v = latLonToVector3(city.lat, city.lon, 1.014);
      coords.push(v.x, v.y, v.z);
      // Bigger metros burn warmer and denser
      const t = Math.min(1, city.pop / 30);
      c.copy(warm).lerp(new THREE.Color("#FF9E3D"), t);
      colors.push(c.r, c.g, c.b);
      // Radius scales with population, sub-linearly so metros do not swamp the map
      sizes.push(0.018 + Math.sqrt(city.pop) * 0.0075);
    }

    return {
      positions: new Float32Array(coords),
      colors: new Float32Array(colors),
      sizes: new Float32Array(sizes),
    };
  }, []);

  // Real coastline geometry, drawn as line loops just above the dot matrix
  const coastlineRings = useMemo(
    () => INDIA_RINGS.map((ring) => indiaCoastlinePositions(1.032, [ring])),
    []
  );

  // Survey graticule + honest scale reference
  const graticule = useMemo(() => buildGraticule(1.0), []);

  // Distinct Regional & Global Beacons with Healthy Spatial Separation
  const groundBeacons: GroundBeaconConfig[] = useMemo(() => [    {
      id: "ahmedabad",
      lat: 23.02,
      lon: 72.57,
      color: "#FE6E00",
      coreColor: "#FFB74D",
      pulseSpeed: 1.4,
    },
    {
      id: "cspdcl-raipur",
      lat: 21.25,
      lon: 81.62,
      color: "#FFB74D",
      coreColor: "#FFFFFF",
      pulseSpeed: 1.6,
    },
    {
      id: "solar-rajasthan",
      lat: 26.9,
      lon: 75.8,
      color: "#FE6E00",
      coreColor: "#FFB74D",
      pulseSpeed: 1.3,
    },
    {
      id: "cloud-singapore",
      lat: 1.35,
      lon: 103.82,
      color: "#38BDF8",
      coreColor: "#FFFFFF",
      pulseSpeed: 1.5,
    },
    {
      id: "cloud-frankfurt",
      lat: 50.11,
      lon: 8.68,
      color: "#38BDF8",
      coreColor: "#FFFFFF",
      pulseSpeed: 1.2,
    },
  ], []);

  // Graceful Inter-Hub Telemetry Arcs
  // Each link carries its own throughput and protocol, drawn as a distinct layer
  // the way a real network topology diagram layers transport types.
  const ARCS = [
    {
      id: "raipur",
      latA: 23.02,
      lonA: 72.57,
      latB: 21.25,
      lonB: 81.62,
      lift: 0.2,
      speed: 0.6,
      offset: 0,
      color: "#FE6E00",
      tubeRadius: 0.004,
      // Ahmedabad <-> CSPDCL (Raipur): the primary field telemetry backhaul
      packets: 3,
      packetOffset: 0,
    },
    {
      id: "rajasthan",
      latA: 23.02,
      lonA: 72.57,
      latB: 26.9,
      lonB: 75.8,
      lift: 0.135,
      speed: 0.75,
      offset: 0.3,
      color: "#FFB74D",
      tubeRadius: 0.0035,
      // Ahmedabad <-> Rajasthan solar: solar irradiance telemetry
      packets: 2,
      packetOffset: 0.5,
    },
    {
      id: "singapore",
      latA: 23.02,
      lonA: 72.57,
      latB: 1.35,
      lonB: 103.82,
      lift: 0.325,
      speed: 0.45,
      offset: 0.6,
      color: "#38BDF8",
      tubeRadius: 0.0045,
      // Ahmedabad <-> Singapore cloud gateway: international ingest
      packets: 3,
      packetOffset: 0.15,
    },
  ];

  // Sphere shading, atmosphere rim and the terminator-aware dot matrix are all
  // shader-driven: no extra render passes, and the night side finally reads dark.
  const coreMaterial = useMemo(() => createGlobeCoreMaterial(SUN_VECTOR), [SUN_VECTOR]);
  const dotMaterial = useMemo(
    () => createTerrainDotMatrixMaterial({ size: 0.038, opacity: 0.96 }),
    []
  );
  const landmarkMaterial = useMemo(() => createLandmarkMaterial(0.1), []);
  const landmarkSecondaryMaterial = useMemo(
    () => createLandmarkMaterial(0.062),
    []
  );
  const nightLightMaterial = useMemo(
    () => createNightLightMaterial({ sun: SUN_VECTOR }),
    [SUN_VECTOR]
  );
  const atmosphereMaterial = useMemo(
    () => createAtmosphereMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );

  useEffect(
    () => () => {
      coreMaterial.dispose();
      dotMaterial.dispose();
      landmarkMaterial.dispose();
      landmarkSecondaryMaterial.dispose();
      nightLightMaterial.dispose();
      atmosphereMaterial.dispose();
    },
    [
      coreMaterial,
      dotMaterial,
      landmarkMaterial,
      landmarkSecondaryMaterial,
      nightLightMaterial,
      atmosphereMaterial,
    ]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Globe Rotation
    if (globeInnerRef.current) {
      globeInnerRef.current.rotation.y += delta * 0.11;
    }

    // Keep the dot-matrix point scale in step with the (possibly adaptive) DPR
    syncDotMatrixScale(
      dotMaterial,
      state.size.height,
      state.viewport.dpr
    );
    syncDotMatrixScale(
      landmarkMaterial,
      state.size.height,
      state.viewport.dpr
    );
    syncDotMatrixScale(
      landmarkSecondaryMaterial,
      state.size.height,
      state.viewport.dpr
    );
    if (landmarkMaterial.uniforms?.uTime) {
      landmarkMaterial.uniforms.uTime.value = t;
    }
    if (landmarkSecondaryMaterial.uniforms?.uTime) {
      // Secondary tier pulses ~40% out of phase so the tiers separate visually
      landmarkSecondaryMaterial.uniforms.uTime.value = t * 0.6 + 1.7;
    }
    syncDotMatrixScale(
      nightLightMaterial,
      state.size.height,
      state.viewport.dpr
    );
    if (coreMaterial.uniforms?.uTime) {
      coreMaterial.uniforms.uTime.value = t;
    }

    // 2. Orbital Satellites Rotation
    if (satellite1Ref.current) {
      satellite1Ref.current.rotation.z += delta * 0.35;
      satellite1Ref.current.rotation.y = Math.sin(t * 0.3) * 0.12;
    }

    if (satellite2Ref.current) {
      satellite2Ref.current.rotation.x += delta * 0.25;
      satellite2Ref.current.rotation.z = Math.cos(t * 0.2) * 0.15;
    }

    // 3. Subtle Pointer Tilt Interaction
    if (rootGroupRef.current) {
      const targetRotY = state.pointer.x * 0.25;
      const targetRotX = -state.pointer.y * 0.18;
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
      <group ref={globeInnerRef} rotation={[0.08, -1.95, 0]}>
        {/* 1. Deep Obsidian Core Sphere (lit in-shader: terminator + warm rim) */}
        <mesh material={coreMaterial}>
          <sphereGeometry args={[0.96, 24, 24]} />
        </mesh>

        {/* 2. Atmospheric Fresnel Orange Halo */}
        <mesh material={atmosphereMaterial}>
          <sphereGeometry args={[1.05, 24, 24]} />
        </mesh>

        {/* 3. Subtle Hairline Lat-Lon Coordinates Grid */}
        <mesh>
          <sphereGeometry args={[1.005, 24, 12]} />
          <meshBasicMaterial
            color="#4A4A4A"
            wireframe
            transparent
            opacity={0.26}
          />
        </mesh>

        {/* 3. Survey Graticule — true 15-degree meridians and parallels */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.standard, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#4A4A4A" transparent opacity={0.34} />
        </line>
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.equator, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FFB74D" transparent opacity={0.5} />
        </line>
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.primeMeridian, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FFB74D" transparent opacity={0.5} />
        </line>

        {/* 4. High-Fidelity Continental Dot Matrix (real relief + hillshade) */}
        <points material={dotMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[pointPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[pointColors, 3]}
            />
          </bufferGeometry>
        </points>

        {/* 6. Real coastline line loops — the actual geography, not a box */}
        {coastlineRings.map((positions, i) => (
          <line key={`coast-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[positions, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#FFDBB0"
              transparent
              opacity={0.85}
            />
          </line>
        ))}

        {/* 7. Named City Landmark Pins — tiered gazetteer hierarchy */}
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

        {/* 8. Night-side urban glow, masked to the dark hemisphere */}
        <points material={nightLightMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[nightLights.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-aColor"
              args={[nightLights.colors, 3]}
            />
            <bufferAttribute
              attach="attributes-aSize"
              args={[nightLights.sizes, 1]}
            />
          </bufferGeometry>
        </points>

        {/* 9. Sleek Flush Radar Ground Beacons (Zero 3D Text, Zero Lollipops) */}
        {groundBeacons.map((b) => (
          <GroundBeacon key={b.id} beacon={b} globeRadius={1.025} />
        ))}

        {/* 7. Inter-Hub Telemetry Arcs (tube + photon packets with comet trails) */}
        {ARCS.map((arc) => (
          <TelemetryArc
            key={arc.id}
            latA={arc.latA}
            lonA={arc.lonA}
            latB={arc.latB}
            lonB={arc.lonB}
            radius={1.025}
            lift={arc.lift}
            speed={arc.speed}
            offset={arc.offset}
            color={arc.color}
            tubeRadius={arc.tubeRadius}
            packets={arc.packets}
            packetOffset={arc.packetOffset}
          />
        ))}

        {/* 8. Tilted Precision Orbital Guidance Rings */}
        <mesh rotation={[Math.PI / 3, 0.3, 0]}>
          <torusGeometry args={[1.045, 0.002, 8, 64]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 4, 0.5, 0]}>
          <torusGeometry args={[1.045, 0.0015, 8, 64]} />
          <meshBasicMaterial color="#797067" transparent opacity={0.25} />
        </mesh>
      </group>

      {/* 9. Orbital Telemetry Satellite */}
      <OrbitalSatellite orbitRadius={1.42} />

      {/* 10. Polar Geosynchronous Beacon 2 */}
      <group ref={satellite2Ref} rotation={[Math.PI / 2.1, -0.4, 0]}>
        <mesh>
          <torusGeometry args={[1.60, 0.0015, 8, 64]} />
          <meshBasicMaterial color="#3D3D3D" transparent opacity={0.25} />
        </mesh>
        <group position={[0, 1.60, 0]}>
          <mesh>
            <octahedronGeometry args={[0.04, 0]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={2.5}
            />
          </mesh>
        </group>
      </group>

      {/* Cartographic furniture (scale bar, north arrow) lives in the DOM overlay
          where it can carry real text labels — see OverlaySections. */}
    </group>
  );
}
