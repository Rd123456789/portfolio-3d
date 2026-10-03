"use client";

import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Project, PROJECTS } from "@/lib/projects";
import { playIndustrialClick, playRadarPing } from "@/lib/sound";

interface FloatingCardsMobileProps {
  onSelectProject: (project: Project) => void;
}

function MobileCard({
  project,
  index,
  position,
  onSelect,
}: {
  project: Project;
  index: number;
  position: [number, number, number];
  onSelect: (project: Project) => void;
}) {
  const meshRef = useRef<THREE.Group>(null!);
  const [active, setActive] = useState(false);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    const floatY = Math.sin(t * 1.5 + index * 1.2) * 0.06;
    const targetScale = active ? 1.05 : 1.0;

    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 8
    );
    meshRef.current.position.y = position[1] + floatY;
  });

  return (
    <group
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        playIndustrialClick();
        onSelect(project);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        playRadarPing();
        setActive(true);
      }}
      onPointerUp={() => {
        setActive(false);
      }}
    >
      {/* 1. Industrial Chassis Shell (#202020) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.35, 1.2, 0.05]} />
        <meshStandardMaterial
          color={active ? "#282828" : "#202020"}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* 2. Recessed Hologram Surface */}
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[2.26, 1.12]} />
        <meshStandardMaterial
          color={active ? "#2D2622" : "#1A1A1A"}
          roughness={0.25}
          metalness={0.7}
        />
      </mesh>

      {/* 3. Dotted Outer Border */}
      <lineSegments position={[0, 0, 0.028]}>
        <edgesGeometry args={[new THREE.BoxGeometry(2.35, 1.2, 0.01)]} />
        <lineBasicMaterial
          color={active ? "#FE6E00" : "#3D3D3D"}
          linewidth={2}
        />
      </lineSegments>

      {/* 4. Four Precision Corner Brackets */}
      <mesh position={[-1.12, 0.55, 0.03]}>
        <planeGeometry args={[0.08, 0.016]} />
        <meshBasicMaterial color={active ? "#FE6E00" : "#8A8A8A"} />
      </mesh>
      <mesh position={[1.12, 0.55, 0.03]}>
        <planeGeometry args={[0.08, 0.016]} />
        <meshBasicMaterial color={active ? "#FE6E00" : "#8A8A8A"} />
      </mesh>
      <mesh position={[-1.12, -0.55, 0.03]}>
        <planeGeometry args={[0.08, 0.016]} />
        <meshBasicMaterial color={active ? "#FE6E00" : "#8A8A8A"} />
      </mesh>
      <mesh position={[1.12, -0.55, 0.03]}>
        <planeGeometry args={[0.08, 0.016]} />
        <meshBasicMaterial color={active ? "#FE6E00" : "#8A8A8A"} />
      </mesh>

      {/* 5. Eyebrow Marker */}
      <mesh position={[-0.92, 0.38, 0.035]}>
        <planeGeometry args={[0.045, 0.045]} />
        <meshBasicMaterial color={active ? "#FE6E00" : "#8A8A8A"} />
      </mesh>

      {/* 6. Eyebrow Readout */}
      <Text
        position={[-0.82, 0.38, 0.035]}
        fontSize={0.075}
        color={active ? "#FE6E00" : "#8A8A8A"}
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.12}
      >
        {`[0${index + 1}] // MISSION SPEC`}
      </Text>

      {/* 7. Title */}
      <Text
        position={[-0.92, 0.12, 0.035]}
        fontSize={0.145}
        color={active ? "#FE6E00" : "#F0F0F0"}
        maxWidth={2.0}
        anchorX="left"
        anchorY="middle"
        letterSpacing={-0.02}
      >
        {project.title}
      </Text>

      {/* 8. Subtitle */}
      <Text
        position={[-0.92, -0.1, 0.035]}
        fontSize={0.08}
        color="#999999"
        maxWidth={2.0}
        anchorX="left"
        anchorY="middle"
      >
        {project.subtitle}
      </Text>

      {/* 9. Tags */}
      <Text
        position={[-0.92, -0.32, 0.035]}
        fontSize={0.07}
        color={active ? "#FFB74D" : "#8A8A8A"}
        maxWidth={1.8}
        anchorX="left"
        anchorY="middle"
      >
        {project.tags.slice(0, 3).join(" • ")}
      </Text>

      {/* 10. Status Indicator */}
      <group position={[0.88, -0.32, 0.035]}>
        <mesh position={[-0.18, 0, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.015]} />
          <meshBasicMaterial color={active ? "#FE6E00" : "#00C758"} />
        </mesh>
        <Text
          position={[-0.1, 0, 0]}
          fontSize={0.06}
          color={active ? "#FE6E00" : "#00C758"}
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.08}
        >
          {active ? "OPEN" : "ACTIVE"}
        </Text>
      </group>
    </group>
  );
}

export default function FloatingCardsMobile({ onSelectProject }: FloatingCardsMobileProps) {
  const mobileConfigs: [number, number, number][] = [
    [0, 0.72, -0.25],
    [0, 0, 0.05],
    [0, -0.72, -0.25],
  ];

  return (
    <group position={[0, 0.05, 0]} scale={[0.76, 0.76, 0.76]}>
      {PROJECTS.slice(0, 3).map((project, i) => (
        <MobileCard
          key={project.id}
          project={project}
          index={i}
          position={mobileConfigs[i]}
          onSelect={onSelectProject}
        />
      ))}
    </group>
  );
}
