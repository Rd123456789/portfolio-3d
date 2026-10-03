"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Particles({ count = 1200 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null!);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const orange = new THREE.Color("#FE6E00");
    const orangeWarm = new THREE.Color("#FFB74D");
    const steel = new THREE.Color("#797067");
    const white = new THREE.Color("#E5E5E5");
    const charcoal = new THREE.Color("#3D3D3D");

    for (let i = 0; i < count; i++) {
      // Cylindrical distribution surrounding the scene
      const radius = 10 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 32;

      pos[i * 3] = Math.cos(theta) * radius;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * radius;

      // Color tiering
      const rand = Math.random();
      const chosenColor =
        rand > 0.8
          ? orange
          : rand > 0.6
          ? orangeWarm
          : rand > 0.3
          ? steel
          : rand > 0.15
          ? charcoal
          : white;

      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.02;
      pointsRef.current.rotation.x += delta * 0.006;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
