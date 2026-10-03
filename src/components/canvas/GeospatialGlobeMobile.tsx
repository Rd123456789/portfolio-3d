"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface GeospatialGlobeMobileProps {
  position?: [number, number, number];
  scale?: number;
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function isLandmass(lat: number, lon: number): boolean {
  if (lat >= 6 && lat <= 36 && lon >= 68 && lon <= 92) return true; // India / South Asia
  if (lat >= 10 && lat <= 50 && lon >= 92 && lon <= 145) return true; // SE Asia
  if (lat >= 12 && lat <= 65 && lon >= -10 && lon <= 65) return true; // Europe & Middle East
  if (lat >= -35 && lat <= 35 && lon >= -18 && lon <= 52) return true; // Africa
  if (lat >= 15 && lat <= 70 && lon >= -168 && lon <= -50) return true; // Americas
  if (lat >= -56 && lat <= 12 && lon >= -82 && lon <= -34) return true;
  return false;
}

interface MobileGroundBeaconConfig {
  id: string;
  lat: number;
  lon: number;
  color: string;
  coreColor: string;
  pulseSpeed: number;
}

// Sleek flush surface radar beacon (zero clunky boxes, zero lollipop sticks, zero 3D text)
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
      {/* 1. Flush Ground Anchor Ring on Sphere Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.026, 24]} />
        <meshBasicMaterial color={beacon.color} side={THREE.DoubleSide} />
      </mesh>

      {/* 2. Concentric Pulsing Wave */}
      <mesh ref={pingRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.02, 0.034, 24]} />
        <meshBasicMaterial
          color={beacon.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 3. Slender Laser Needle (Hairline 0.001) */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.001, 0.002, 0.08, 8]} />
        <meshBasicMaterial color={beacon.coreColor} transparent opacity={0.85} />
      </mesh>

      {/* 4. Glowing Micro Point */}
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.009, 10, 10]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

export default function GeospatialGlobeMobile({
  position = [0, 1.35, -0.5],
  scale = 1.15,
}: GeospatialGlobeMobileProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const globeInnerRef = useRef<THREE.Group>(null!);
  const orbitRingRef = useRef<THREE.Group>(null!);
  const arcPacketRef = useRef<THREE.Mesh>(null!);

  // Mobile Continental Dot Matrix (680 crisp points for buttery 60 FPS mobile performance)
  const [pointPositions, pointColors] = useMemo(() => {
    const coords: number[] = [];
    const colors: number[] = [];

    const orange = new THREE.Color("#FE6E00");
    const orangeWarm = new THREE.Color("#FFB74D");
    const white = new THREE.Color("#FFFFFF");
    const steel = new THREE.Color("#4A4A4A");

    for (let lat = -80; lat <= 80; lat += 4.2) {
      const radiusAtLat = Math.cos((lat * Math.PI) / 180);
      const lonStep = Math.max(4.2, 4.2 / (radiusAtLat || 0.1));

      for (let lon = -180; lon < 180; lon += lonStep) {
        const isLand = isLandmass(lat, lon);
        if (!isLand && Math.random() > 0.12) continue;

        const isIndia = lat >= 8 && lat <= 32 && lon >= 68 && lon <= 88;
        const radius = isLand ? (isIndia ? 1.026 : 1.02) : 1.01;
        const v = latLonToVector3(lat, lon, radius);

        coords.push(v.x, v.y, v.z);

        if (isIndia) {
          colors.push(orange.r, orange.g, orange.b);
        } else if (isLand) {
          const col = Math.random() > 0.4 ? white : orangeWarm;
          colors.push(col.r, col.g, col.b);
        } else {
          colors.push(steel.r, steel.g, steel.b);
        }
      }
    }

    return [new Float32Array(coords), new Float32Array(colors)];
  }, []);

  // Distinct Regional Beacons
  const beacons: MobileGroundBeaconConfig[] = useMemo(() => [
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
  ], []);

  // Mobile Great Circle Arc: Ahmedabad <-> Raipur
  const { arcCurve, arcPoints } = useMemo(() => {
    const p1 = latLonToVector3(23.02, 72.57, 1.025);
    const p2 = latLonToVector3(21.25, 81.62, 1.025);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(1.20);
    const c = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    return {
      arcCurve: c,
      arcPoints: c.getPoints(24),
    };
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (globeInnerRef.current) {
      globeInnerRef.current.rotation.y += delta * 0.12;
    }

    if (orbitRingRef.current) {
      orbitRingRef.current.rotation.z += delta * 0.35;
      orbitRingRef.current.rotation.y = Math.sin(t * 0.3) * 0.1;
    }

    if (arcPacketRef.current && arcCurve) {
      const u = (t * 0.6) % 1;
      const pt = arcCurve.getPoint(u);
      arcPacketRef.current.position.copy(pt);
    }

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
        {/* 1. Deep Core Shell (#141414) */}
        <mesh>
          <sphereGeometry args={[0.96, 24, 24]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.25}
            metalness={0.7}
          />
        </mesh>

        {/* 2. Atmospheric Halo */}
        <mesh>
          <sphereGeometry args={[1.04, 24, 24]} />
          <meshStandardMaterial
            color="#FE6E00"
            transparent
            opacity={0.07}
            side={THREE.BackSide}
          />
        </mesh>

        {/* 3. Lat-Lon Wireframe Grid */}
        <mesh>
          <sphereGeometry args={[1.005, 24, 12]} />
          <meshStandardMaterial
            color="#3D3D3D"
            wireframe
            transparent
            opacity={0.18}
          />
        </mesh>

        {/* 4. Continental Telemetry Dots */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[pointPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[pointColors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.044}
            vertexColors
            transparent
            opacity={0.96}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        {/* 5. Mobile Flush Surface Radar Ground Beacons (Zero 3D Text, Zero Lollipops) */}
        {beacons.map((b) => (
          <MobileGroundBeacon key={b.id} beacon={b} globeRadius={1.025} />
        ))}

        {/* 6. Inter-City Telemetry Arc */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(arcPoints.flatMap((p) => [p.x, p.y, p.z])),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FE6E00" transparent opacity={0.75} />
        </line>

        {/* 7. Traveling Data Packet on Arc */}
        <mesh ref={arcPacketRef}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>

        {/* 8. Precision Instrument Orbital Ring */}
        <mesh rotation={[Math.PI / 3, 0.4, 0]}>
          <torusGeometry args={[1.045, 0.002, 12, 60]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.45} />
        </mesh>
      </group>

      {/* 9. Orbiting Satellite Micro Node */}
      <group ref={orbitRingRef} rotation={[0.45, 0.2, 0.8]}>
        <mesh>
          <torusGeometry args={[1.38, 0.002, 12, 60]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.35} />
        </mesh>
        <mesh position={[1.38, 0, 0]}>
          <boxGeometry args={[0.05, 0.025, 0.025]} />
          <meshStandardMaterial
            color="#FE6E00"
            emissive="#FE6E00"
            emissiveIntensity={3}
          />
        </mesh>
      </group>
    </group>
  );
}
