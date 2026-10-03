"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AvatarProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export default function Avatar({
  position = [1.8, -0.4, 0],
  rotation = [0, -0.3, 0],
  scale = 1,
}: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Gentle floating / breathing idle motion
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.12;
    }

    // 2. Head smoothly tracks mouse / pointer
    if (headRef.current) {
      const targetRotY = state.pointer.x * 0.45;
      const targetRotX = -state.pointer.y * 0.35;
      headRef.current.rotation.y = THREE.MathUtils.damp(
        headRef.current.rotation.y,
        targetRotY,
        4,
        delta
      );
      headRef.current.rotation.x = THREE.MathUtils.damp(
        headRef.current.rotation.x,
        targetRotX,
        4,
        delta
      );
    }

    // 3. Orbital cyber rings rotation
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.8;
      ringRef.current.rotation.x = Math.sin(t * 0.7) * 0.2;
    }

    // 4. Core energy pulsing
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 3) * 0.15;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Orbital Hologram Rings */}
      <mesh ref={ringRef} position={[0, 0.4, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={2.5}
          metalness={0.9}
          roughness={0.1}
          wireframe
        />
      </mesh>

      {/* Outer Gyro Ring */}
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 3, 0.4, 0]}>
        <torusGeometry args={[1.7, 0.015, 16, 80]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#9333ea"
          emissiveIntensity={1.8}
          metalness={0.8}
          roughness={0.2}
          wireframe
        />
      </mesh>

      {/* HEAD GROUP (Interactive Mouse Look) */}
      <group ref={headRef} position={[0, 1.25, 0]}>
        {/* Cranium / Main Helmet Shell */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>

        {/* Cyber Visor / Faceplate */}
        <mesh position={[0, 0.02, 0.38]} castShadow>
          <boxGeometry args={[0.72, 0.28, 0.36]} />
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#0284c7"
            emissiveIntensity={3.2}
            roughness={0.1}
            metalness={0.9}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Visor HUD scanline accent */}
        <mesh position={[0, 0.02, 0.57]}>
          <planeGeometry args={[0.68, 0.04]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* Head Side Antennas / Audio Nodes */}
        <mesh position={[0.66, 0, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <cylinderGeometry args={[0.04, 0.08, 0.3, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-0.66, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
          <cylinderGeometry args={[0.04, 0.08, 0.3, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* NECK JOINT */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.28, 20]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* TORSO & SHOULDERS */}
      <group position={[0, 0.05, 0]}>
        {/* Main Chest Armor */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.95, 0.65]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>

        {/* Central Glowing Energy Reactor Core */}
        <mesh ref={coreRef} position={[0, 0.12, 0.34]}>
          <sphereGeometry args={[0.15, 32, 32]} />
          <meshStandardMaterial
            color="#06b6d4"
            emissive="#06b6d4"
            emissiveIntensity={4.5}
            roughness={0.1}
          />
        </mesh>

        {/* Reactor Core Glass Ring */}
        <mesh position={[0, 0.12, 0.33]}>
          <torusGeometry args={[0.2, 0.03, 16, 32]} />
          <meshStandardMaterial
            color="#64748b"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>

        {/* Left Shoulder Pauldron */}
        <mesh position={[-0.8, 0.35, 0]} rotation={[0, 0, 0.2]} castShadow>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>

        {/* Right Shoulder Pauldron */}
        <mesh position={[0.8, 0.35, 0]} rotation={[0, 0, -0.2]} castShadow>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>

        {/* Lower Spine / Abdominal Link */}
        <mesh position={[0, -0.65, 0]}>
          <cylinderGeometry args={[0.35, 0.42, 0.45, 16]} />
          <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
