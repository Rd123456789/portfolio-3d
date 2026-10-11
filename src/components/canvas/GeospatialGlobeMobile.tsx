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

interface GeospatialGlobeMobileProps {
  position?: [number, number, number];
  scale?: number;
}

interface MobileGroundBeaconConfig {
  id: string;
  lat: number;
  lon: number;
  color: string;
  coreColor: string;
  pulseSpeed: number;
}

// Flush surface radar beacon: anchor ring, expanding wave, needle and point.
// Same read as the desktop beacon, reduced one ring because the phone screen is
// a quarter the area and a second wave just muddies it.
function MobileGroundBeacon({
  beacon,
  globeRadius,
}: {
  beacon: MobileGroundBeaconConfig;
  globeRadius: number;
}) {
  const pingRingRef = useRef<THREE.Mesh>(null!);

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
    if (pingRingRef.current) {
      const p = (t * beacon.pulseSpeed) % 1;
      const s = 1 + p * 2.8;
      pingRingRef.current.scale.set(s, s, s);
      const mat = pingRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = Math.max(0, 0.85 * (1 - p));
      }
    }
  });

  return (
    <group position={position} quaternion={orientationQuat}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.026, 16]} />
        <meshBasicMaterial color={beacon.color} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={pingRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.02, 0.034, 16]} />
        <meshBasicMaterial
          color={beacon.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>

      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.001, 0.002, 0.08, 6]} />
        <meshBasicMaterial color={beacon.coreColor} transparent opacity={0.85} />
      </mesh>

      {/* Data column rising off the beacon */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.005, 0.008, 0.16, 6]} />
        <meshBasicMaterial
          color={beacon.color}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial
          color={beacon.color}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Scratch vector reused by the arc riders — keeps the frame loop allocation-free.
const ARC_POSITION = new THREE.Vector3();

export default function GeospatialGlobeMobile({
  position = [0, 0, 0],
  scale = 1,
}: GeospatialGlobeMobileProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const globeInnerRef = useRef<THREE.Group>(null!);
  const orbitRingRef = useRef<THREE.Group>(null!);
  const arcPacketRefs = useRef<THREE.Mesh[]>([]);
  const arcTrailRefs = useRef<THREE.Mesh[]>([]);

  // Sun vector for the true sub-solar point at the current wall-clock time, so
  // the terminator, night lights and relief shading all agree on the phone too.
  const SUN_VECTOR = useMemo(() => sceneSunVector(new Date()), []);

  // Terrain dot matrix at a coarser lattice than desktop: the phone renders far
  // fewer pixels, so a dense lattice would only cost fill with no visible gain.
  const terrainMatrix = useMemo(
    () => buildTerrainDotMatrix(4.0, 0.14, 0.014, SUN_VECTOR),
    [SUN_VECTOR]
  );
  const pointPositions = terrainMatrix.positions;
  const pointColors = terrainMatrix.colors;

  // Real coastline line loops, identical geography to the desktop globe
  const coastlineRings = useMemo(
    () => INDIA_RINGS.map((ring) => indiaCoastlinePositions(1.032, [ring])),
    []
  );

  // Survey graticule at true 15-degree intervals
  const graticule = useMemo(() => buildGraticule(1.0), []);

  // City gazetteer, tiered. Fewer secondary cities than desktop so the pin set
  // still reads at phone scale instead of turning into noise.
  const tier1Markers = useMemo(
    () =>
      buildLandmarkMarkers([
        { lat: 23.02, lon: 72.57, color: "#FFB74D" }, // Ahmedabad
        { lat: 21.25, lon: 81.62, color: "#FFB74D" }, // Raipur
        { lat: 26.9, lon: 75.8, color: "#FE6E00" }, // Jaipur
        { lat: 1.35, lon: 103.82, color: "#38BDF8" }, // Singapore
      ]),
    []
  );
  const tier2Markers = useMemo(
    () =>
      buildLandmarkMarkers([
        { lat: 19.07, lon: 72.87, color: "#FFFFFF" }, // Mumbai
        { lat: 28.61, lon: 77.2, color: "#FFFFFF" }, // Delhi
        { lat: 12.97, lon: 77.59, color: "#FFFFFF" }, // Bengaluru
        { lat: 22.57, lon: 88.36, color: "#FFFFFF" }, // Kolkata
        { lat: 50.11, lon: 8.68, color: "#38BDF8" }, // Frankfurt
      ]),
    []
  );

  // Night-side urban glow, sized by real metropolitan population
  const nightLights = useMemo(() => {
    const cities = [
      { lat: 28.61, lon: 77.2, pop: 32.9 },
      { lat: 19.07, lon: 72.87, pop: 21.7 },
      { lat: 22.57, lon: 88.36, pop: 15.3 },
      { lat: 12.97, lon: 77.59, pop: 13.6 },
      { lat: 13.08, lon: 80.27, pop: 11.5 },
      { lat: 23.02, lon: 72.57, pop: 8.4 },
      { lat: 17.38, lon: 78.48, pop: 10.5 },
      { lat: 26.9, lon: 75.8, pop: 4.0 },
      { lat: 21.25, lon: 81.62, pop: 1.4 },
      { lat: 25.2, lon: 55.27, pop: 3.5 },
      { lat: 1.35, lon: 103.82, pop: 6.0 },
    ];

    const coords: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const warm = new THREE.Color("#FFD9A0");
    const c = new THREE.Color();

    for (const city of cities) {
      const v = latLonToVector3(city.lat, city.lon, 1.014);
      coords.push(v.x, v.y, v.z);
      const t = Math.min(1, city.pop / 30);
      c.copy(warm).lerp(new THREE.Color("#FF9E3D"), t);
      colors.push(c.r, c.g, c.b);
      sizes.push(0.018 + Math.sqrt(city.pop) * 0.0075);
    }

    return {
      positions: new Float32Array(coords),
      colors: new Float32Array(colors),
      sizes: new Float32Array(sizes),
    };
  }, []);

  const beacons: MobileGroundBeaconConfig[] = useMemo(
    () => [
      {
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
        id: "cloud-singapore",
        lat: 1.35,
        lon: 103.82,
        color: "#38BDF8",
        coreColor: "#FFFFFF",
        pulseSpeed: 1.3,
      },
    ],
    []
  );

  // Two telemetry links, matching the two most important desktop routes.
  // Each carries photon riders with comet trails.
  const ARCS = useMemo(
    () => [
      {
        id: "raipur",
        curve: buildGreatCircleArc(23.02, 72.57, 21.25, 81.62, 1.025, 0.2),
        color: "#FE6E00",
        packets: 2,
        speed: 0.6,
      },
      {
        id: "singapore",
        curve: buildGreatCircleArc(23.02, 72.57, 1.35, 103.82, 1.025, 0.325),
        color: "#38BDF8",
        packets: 2,
        speed: 0.45,
      },
    ],
    []
  );

  const arcTubes = useMemo(
    () =>
      ARCS.map(
        (a) => new THREE.TubeGeometry(a.curve, 22, 0.004, 5, false)
      ),
    [ARCS]
  );

  const coreMaterial = useMemo(
    () => createGlobeCoreMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );
  const dotMaterial = useMemo(
    () => createTerrainDotMatrixMaterial({ size: 0.05, opacity: 0.96 }),
    []
  );
  const atmosphereMaterial = useMemo(
    () => createAtmosphereMaterial(SUN_VECTOR),
    [SUN_VECTOR]
  );
  const landmarkMaterial = useMemo(() => createLandmarkMaterial(0.13), []);
  const landmarkSecondaryMaterial = useMemo(
    () => createLandmarkMaterial(0.085),
    []
  );
  const nightLightMaterial = useMemo(
    () => createNightLightMaterial({ sun: SUN_VECTOR }),
    [SUN_VECTOR]
  );

  useEffect(
    () => () => {
      coreMaterial.dispose();
      dotMaterial.dispose();
      atmosphereMaterial.dispose();
      landmarkMaterial.dispose();
      landmarkSecondaryMaterial.dispose();
      nightLightMaterial.dispose();
      arcTubes.forEach((g) => g.dispose());
    },
    [
      coreMaterial,
      dotMaterial,
      atmosphereMaterial,
      landmarkMaterial,
      landmarkSecondaryMaterial,
      nightLightMaterial,
      arcTubes,
    ]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (globeInnerRef.current) {
      globeInnerRef.current.rotation.y += delta * 0.12;
    }

    syncDotMatrixScale(dotMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(landmarkMaterial, state.size.height, state.viewport.dpr);
    syncDotMatrixScale(
      landmarkSecondaryMaterial,
      state.size.height,
      state.viewport.dpr
    );
    syncDotMatrixScale(
      nightLightMaterial,
      state.size.height,
      state.viewport.dpr
    );

    if (landmarkMaterial.uniforms?.uTime) {
      landmarkMaterial.uniforms.uTime.value = t;
    }
    if (landmarkSecondaryMaterial.uniforms?.uTime) {
      landmarkSecondaryMaterial.uniforms.uTime.value = t * 0.6 + 1.7;
    }
    if (coreMaterial.uniforms?.uTime) {
      coreMaterial.uniforms.uTime.value = t;
    }

    if (orbitRingRef.current) {
      orbitRingRef.current.rotation.z += delta * 0.35;
      orbitRingRef.current.rotation.y = Math.sin(t * 0.3) * 0.1;
    }

    // Photon riders on each link, phased so the two routes never sync up
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
          arc.curve.getPoint((u - 0.04 + 1) % 1, ARC_POSITION);
          trail.position.copy(ARC_POSITION);
        }
      }
    });

    // Touch tilt response
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
      <group ref={globeInnerRef} rotation={[0.08, -1.95, 0]}>
        {/* 1. Deep Core Shell (lit in-shader: terminator + warm rim) */}
        <mesh material={coreMaterial}>
          <sphereGeometry args={[0.96, 20, 20]} />
        </mesh>

        {/* 2. Atmospheric Halo with forward scattering */}
        <mesh material={atmosphereMaterial}>
          <sphereGeometry args={[1.04, 20, 20]} />
        </mesh>

        {/* 3. Survey graticule at true 15-degree intervals */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.standard, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#4A4A4A" transparent opacity={0.3} />
        </line>
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[graticule.equator, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FFB74D" transparent opacity={0.45} />
        </line>

        {/* 4. Continental terrain dots (relief + hillshade baked on the CPU) */}
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

        {/* 5. Real coastline line loops */}
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
              opacity={0.8}
            />
          </line>
        ))}

        {/* 6. Tiered city pins */}
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

        {/* 7. Night-side urban glow, masked to the dark hemisphere */}
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

        {/* 8. Flush surface radar ground beacons */}
        {beacons.map((b) => (
          <MobileGroundBeacon key={b.id} beacon={b} globeRadius={1.025} />
        ))}

        {/* 9. Telemetry links with photon riders and comet trails */}
        {ARCS.map((arc, ai) => (
          <React.Fragment key={arc.id}>
            <mesh geometry={arcTubes[ai]}>
              <meshBasicMaterial
                color={arc.color}
                transparent
                opacity={0.55}
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
                  <sphereGeometry args={[0.008, 6, 6]} />
                  <meshBasicMaterial
                    color={arc.color}
                    transparent
                    opacity={0.3}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    arcPacketRefs.current[ai * 3 + i] = el as THREE.Mesh;
                  }}
                >
                  <sphereGeometry args={[0.013, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}

        {/* 10. Precision instrument orbital ring */}
        <mesh rotation={[Math.PI / 3, 0.4, 0]}>
          <torusGeometry args={[1.045, 0.002, 6, 40]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.45} />
        </mesh>
      </group>

      {/* 11. Orbiting satellite micro node — long thin deployed arrays on a small
          bus, the same spacecraft silhouette as the desktop unit. */}
      <group ref={orbitRingRef} rotation={[0.45, 0.2, 0.8]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.38, 0.002, 6, 40]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.32} />
        </mesh>
        <group position={[1.38, 0, 0]}>
          {/* Deployed arrays: three thin cells per wing */}
          {[-1, 1].map((dir) => (
            <group key={dir} position={[dir * 0.028, 0, 0]}>
              {Array.from({ length: 3 }, (_, i) => (
                <mesh
                  key={i}
                  position={[dir * (0.038 + i * 0.055 + 0.0275), 0, 0]}
                >
                  <boxGeometry args={[0.0518, 0.002, 0.04]} />
                  <meshStandardMaterial
                    color="#1E2A44"
                    metalness={0.65}
                    roughness={0.35}
                    emissive="#3B6FE2"
                    emissiveIntensity={0.3}
                  />
                </mesh>
              ))}
            </group>
          ))}

          {/* Small cylindrical bus with a gold MLI band */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.024, 0.024, 0.046, 8]} />
            <meshStandardMaterial color="#2A2A2A" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 8]} />
            <meshStandardMaterial
              color="#FFB74D"
              metalness={0.9}
              roughness={0.15}
              emissive="#FFB74D"
              emissiveIntensity={0.3}
            />
          </mesh>

          {/* High-gain dish pointed at the ground station */}
          <mesh position={[0, -0.034, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.024, 0.018, 10, 1, true]} />
            <meshStandardMaterial
              color="#C9C9C9"
              metalness={0.9}
              roughness={0.25}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Nadir instrument aperture */}
          <mesh position={[0, 0.028, 0]} rotation={[Math.PI, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.011, 10]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={2.5}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
