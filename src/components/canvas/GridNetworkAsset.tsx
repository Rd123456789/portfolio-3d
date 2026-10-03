"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function GridNetworkAsset({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number];
  scale?: number;
}) {
  const rootRef = useRef<THREE.Group>(null!);
  const beaconLightRef = useRef<THREE.PointLight>(null!);
  const radarHeadRef = useRef<THREE.Group>(null!);
  const arcLightRef = useRef<THREE.PointLight>(null!);

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

    // Warning strobe beacon (sharp aviation flash)
    if (beaconLightRef.current) {
      const strobe = Math.sin(t * 8) > 0.6 ? 4.5 : 0.8;
      beaconLightRef.current.intensity = strobe;
    }

    // High voltage arc shimmer
    if (arcLightRef.current) {
      arcLightRef.current.intensity = 2 + Math.sin(t * 12) * 1.2;
    }
  });

  return (
    <group ref={rootRef} position={position} scale={scale}>
      {/* 1. Substation Concrete Foundation Base */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[1.1, 1.3, 0.25, 8]} />
        <meshStandardMaterial
          color="#1A1A1A"
          metalness={0.8}
          roughness={0.4}
        />
      </mesh>

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

      {/* 4. Upper Cross-Arm Distribution Girders (Left & Right Spans) */}
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.8, 8]} />
        <meshStandardMaterial color="#8A8A8A" metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 2.2, 8]} />
        <meshStandardMaterial color="#8A8A8A" metalness={0.9} />
      </mesh>

      {/* 5. Ceramic Disc Insulator Strings (6 Suspension Clusters) */}
      {[-0.9, -0.5, 0.5, 0.9].map((xOffset, i) => (
        <group key={i} position={[xOffset, 0.55, 0]}>
          {/* Stacked ceramic discs */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 12]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={2.5}
            />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.03, 12]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={2.2}
            />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.03, 12]} />
            <meshStandardMaterial
              color="#FE6E00"
              emissive="#FE6E00"
              emissiveIntensity={2.0}
            />
          </mesh>
          {/* Conductor Cable Terminal Clamp */}
          <mesh position={[0, -0.15, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      ))}

      {/* Catenary High-Voltage Transmission Power Cables */}
      <mesh position={[-0.7, 0.48, 0.05]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.012, 0.012, 0.45, 6]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#D95B28"
          emissiveIntensity={1.5}
        />
      </mesh>
      <mesh position={[0.7, 0.48, 0.05]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.012, 0.012, 0.45, 6]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#D95B28"
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Rotating Corona Discharge Ring */}
      <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.015, 8, 24]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#FE6E00"
          emissiveIntensity={3}
          wireframe
        />
      </mesh>

      {/* 6. High-Voltage Plasma Reactor Core */}
      <mesh position={[0, 1.45, 0]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          color="#FE6E00"
          emissive="#FE6E00"
          emissiveIntensity={4.5}
        />
      </mesh>
      <pointLight
        ref={arcLightRef}
        position={[0, 1.45, 0]}
        color="#FE6E00"
        distance={8}
        intensity={2.8}
      />

      {/* 7. Rotating Top LIDAR Sensor Head */}
      <group ref={radarHeadRef} position={[0, 1.75, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
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

      {/* 8. Apex Aviation Warning Strobe */}
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <pointLight
        ref={beaconLightRef}
        position={[0, 1.95, 0]}
        color="#FE6E00"
        distance={9}
        intensity={3.5}
      />
    </group>
  );
}
