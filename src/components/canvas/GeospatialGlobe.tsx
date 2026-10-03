"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface GeospatialGlobeProps {
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
  if (lat >= 10 && lat <= 50 && lon >= 92 && lon <= 145) return true; // East Asia / SE Asia
  if (lat >= 12 && lat <= 65 && lon >= -10 && lon <= 65) return true; // Europe & Middle East
  if (lat >= -35 && lat <= 35 && lon >= -18 && lon <= 52) return true; // Africa
  if (lat >= 15 && lat <= 70 && lon >= -168 && lon <= -50) return true; // North America
  if (lat >= -56 && lat <= 12 && lon >= -82 && lon <= -34) return true; // South America
  if (lat >= -44 && lat <= -10 && lon >= 112 && lon <= 155) return true; // Australia
  return false;
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
function GroundBeacon({
  beacon,
  globeRadius,
}: {
  beacon: GroundBeaconConfig;
  globeRadius: number;
}) {
  const pingRing1Ref = useRef<THREE.Mesh>(null!);
  const pingRing2Ref = useRef<THREE.Mesh>(null!);

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

    // Concentric expanding radar rings that pulse along the surface curvature
    if (pingRing1Ref.current) {
      const p1 = (t * beacon.pulseSpeed) % 1;
      const s1 = 1 + p1 * 3.2;
      pingRing1Ref.current.scale.set(s1, s1, s1);
      const mat1 = pingRing1Ref.current.material as THREE.MeshBasicMaterial;
      if (mat1) {
        mat1.opacity = Math.max(0, 0.85 * (1 - p1));
      }
    }

    if (pingRing2Ref.current) {
      const p2 = (t * beacon.pulseSpeed + 0.5) % 1;
      const s2 = 1 + p2 * 3.2;
      pingRing2Ref.current.scale.set(s2, s2, s2);
      const mat2 = pingRing2Ref.current.material as THREE.MeshBasicMaterial;
      if (mat2) {
        mat2.opacity = Math.max(0, 0.85 * (1 - p2));
      }
    }
  });

  return (
    <group position={position} quaternion={orientationQuat}>
      {/* 1. Flush Ground Station Anchor Ring on Sphere Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.012, 0.022, 32]} />
        <meshBasicMaterial color={beacon.color} side={THREE.DoubleSide} />
      </mesh>

      {/* 2. Concentric Pulsing Wave 1 */}
      <mesh ref={pingRing1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.018, 0.028, 32]} />
        <meshBasicMaterial
          color={beacon.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 3. Concentric Pulsing Wave 2 */}
      <mesh ref={pingRing2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.018, 0.028, 32]} />
        <meshBasicMaterial
          color={beacon.color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 4. Ultra-fine Vertical Laser Light Needle (Hairline 0.0015, pure additive laser) */}
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.001, 0.002, 0.09, 8]} />
        <meshBasicMaterial color={beacon.coreColor} transparent opacity={0.85} />
      </mesh>

      {/* 5. Glowing Micro Point */}
      <mesh position={[0, 0.09, 0]}>
        <sphereGeometry args={[0.01, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

export default function GeospatialGlobe({
  position = [1.25, -0.05, 0],
  scale = 1.65,
}: GeospatialGlobeProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const globeInnerRef = useRef<THREE.Group>(null!);
  const satellite1Ref = useRef<THREE.Group>(null!);
  const satellite2Ref = useRef<THREE.Group>(null!);
  const dataPacket1Ref = useRef<THREE.Mesh>(null!);
  const dataPacket2Ref = useRef<THREE.Mesh>(null!);
  const dataPacket3Ref = useRef<THREE.Mesh>(null!);

  // High-Density Continental Dot Matrix (Refined Landmass Fidelity)
  const [pointPositions, pointColors] = useMemo(() => {
    const coords: number[] = [];
    const colors: number[] = [];

    const orange = new THREE.Color("#FE6E00");
    const orangeWarm = new THREE.Color("#FFB74D");
    const white = new THREE.Color("#FFFFFF");
    const steel = new THREE.Color("#4A4A4A");

    for (let lat = -80; lat <= 80; lat += 2.8) {
      const radiusAtLat = Math.cos((lat * Math.PI) / 180);
      const lonStep = Math.max(2.8, 2.8 / (radiusAtLat || 0.1));

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
          const col = Math.random() > 0.35 ? white : (Math.random() > 0.5 ? orangeWarm : steel);
          colors.push(col.r, col.g, col.b);
        } else {
          colors.push(steel.r, steel.g, steel.b);
        }
      }
    }

    return [new Float32Array(coords), new Float32Array(colors)];
  }, []);

  // Distinct Regional & Global Beacons with Healthy Spatial Separation
  const groundBeacons: GroundBeaconConfig[] = useMemo(() => [
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

  // Graceful Inter-Hub Great Circle Telemetry Arcs
  const { arc1Curve, arc1Points, arc2Curve, arc2Points, arc3Curve, arc3Points } = useMemo(() => {
    // Arc 1: Ahmedabad (HQ) <-> CSPDCL (Raipur)
    const p1 = latLonToVector3(23.02, 72.57, 1.025);
    const p2 = latLonToVector3(21.25, 81.62, 1.025);
    const mid1 = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid1.normalize().multiplyScalar(1.22);
    const c1 = new THREE.QuadraticBezierCurve3(p1, mid1, p2);

    // Arc 2: Ahmedabad (HQ) <-> Solar Production (Rajasthan)
    const p3 = latLonToVector3(26.9, 75.8, 1.025);
    const mid2 = new THREE.Vector3().addVectors(p1, p3).multiplyScalar(0.5);
    mid2.normalize().multiplyScalar(1.16);
    const c2 = new THREE.QuadraticBezierCurve3(p1, mid2, p3);

    // Arc 3: Ahmedabad <-> Global Cloud Gateway (Singapore)
    const p4 = latLonToVector3(1.35, 103.82, 1.025);
    const mid3 = new THREE.Vector3().addVectors(p1, p4).multiplyScalar(0.5);
    mid3.normalize().multiplyScalar(1.35);
    const c3 = new THREE.QuadraticBezierCurve3(p1, mid3, p4);

    return {
      arc1Curve: c1,
      arc1Points: c1.getPoints(36),
      arc2Curve: c2,
      arc2Points: c2.getPoints(28),
      arc3Curve: c3,
      arc3Points: c3.getPoints(44),
    };
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Globe Rotation
    if (globeInnerRef.current) {
      globeInnerRef.current.rotation.y += delta * 0.11;
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

    // 3. Telemetry Packets Gliding Along Flight Arcs
    if (dataPacket1Ref.current && arc1Curve) {
      const u1 = (t * 0.6) % 1;
      const pt1 = arc1Curve.getPoint(u1);
      dataPacket1Ref.current.position.copy(pt1);
    }

    if (dataPacket2Ref.current && arc2Curve) {
      const u2 = (t * 0.75 + 0.3) % 1;
      const pt2 = arc2Curve.getPoint(u2);
      dataPacket2Ref.current.position.copy(pt2);
    }

    if (dataPacket3Ref.current && arc3Curve) {
      const u3 = (t * 0.45 + 0.6) % 1;
      const pt3 = arc3Curve.getPoint(u3);
      dataPacket3Ref.current.position.copy(pt3);
    }

    // 4. Subtle Pointer Tilt Interaction
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
        {/* 1. Deep Obsidian Core Sphere */}
        <mesh>
          <sphereGeometry args={[0.96, 32, 32]} />
          <meshPhysicalMaterial
            color="#141414"
            roughness={0.2}
            metalness={0.7}
            transmission={0.3}
            thickness={0.5}
            reflectivity={0.8}
          />
        </mesh>

        {/* 2. Atmospheric Fresnel Orange Halo */}
        <mesh>
          <sphereGeometry args={[1.05, 32, 32]} />
          <meshStandardMaterial
            color="#FE6E00"
            transparent
            opacity={0.07}
            side={THREE.BackSide}
          />
        </mesh>

        {/* 3. Subtle Hairline Lat-Lon Coordinates Grid */}
        <mesh>
          <sphereGeometry args={[1.005, 32, 16]} />
          <meshStandardMaterial
            color="#3D3D3D"
            wireframe
            transparent
            opacity={0.16}
          />
        </mesh>

        {/* 4. High-Fidelity Continental Dot Matrix */}
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
            size={0.038}
            vertexColors
            transparent
            opacity={0.96}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        {/* 5. Sleek Flush Radar Ground Beacons (Zero 3D Text, Zero Lollipops) */}
        {groundBeacons.map((b) => (
          <GroundBeacon key={b.id} beacon={b} globeRadius={1.025} />
        ))}

        {/* 6. Inter-City Telemetry Arcs */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(arc1Points.flatMap((p) => [p.x, p.y, p.z])),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FE6E00" transparent opacity={0.75} />
        </line>

        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(arc2Points.flatMap((p) => [p.x, p.y, p.z])),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FFB74D" transparent opacity={0.65} />
        </line>

        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(arc3Points.flatMap((p) => [p.x, p.y, p.z])),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#38BDF8" transparent opacity={0.55} />
        </line>

        {/* 7. Animated Telemetry Photon Packets */}
        <mesh ref={dataPacket1Ref}>
          <sphereGeometry args={[0.016, 12, 12]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>

        <mesh ref={dataPacket2Ref}>
          <sphereGeometry args={[0.014, 12, 12]} />
          <meshBasicMaterial color="#FFB74D" />
        </mesh>

        <mesh ref={dataPacket3Ref}>
          <sphereGeometry args={[0.015, 12, 12]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>

        {/* 8. Tilted Precision Orbital Guidance Rings */}
        <mesh rotation={[Math.PI / 3, 0.3, 0]}>
          <torusGeometry args={[1.045, 0.002, 16, 120]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 4, 0.5, 0]}>
          <torusGeometry args={[1.045, 0.0015, 16, 120]} />
          <meshBasicMaterial color="#797067" transparent opacity={0.25} />
        </mesh>
      </group>

      {/* 9. Orbital Telemetry Satellite 1 */}
      <group ref={satellite1Ref} rotation={[0.45, 0.2, 0.75]}>
        <mesh>
          <torusGeometry args={[1.42, 0.002, 16, 120]} />
          <meshBasicMaterial color="#FE6E00" transparent opacity={0.35} />
        </mesh>

        <group position={[1.42, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.08, 0.04, 0.05]} />
            <meshStandardMaterial
              color="#242424"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>

          {/* Forward Sensor Aperture */}
          <mesh position={[0.045, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.015, 16]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={3}
            />
          </mesh>

          {/* Dual Solar Wings */}
          <mesh position={[0, 0.065, 0]}>
            <boxGeometry args={[0.06, 0.055, 0.004]} />
            <meshStandardMaterial
              color="#FFB74D"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[0, -0.065, 0]}>
            <boxGeometry args={[0.06, 0.055, 0.004]} />
            <meshStandardMaterial
              color="#FFB74D"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        </group>
      </group>

      {/* 10. Polar Geosynchronous Beacon 2 */}
      <group ref={satellite2Ref} rotation={[Math.PI / 2.1, -0.4, 0]}>
        <mesh>
          <torusGeometry args={[1.60, 0.0015, 16, 120]} />
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
    </group>
  );
}
