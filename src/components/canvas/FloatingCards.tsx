"use client";

import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Project, PROJECTS } from "@/lib/projects";
import { playRadarPing, playIndustrialClick } from "@/lib/sound";

interface FloatingCardProps {
  project: Project;
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  onSelect: (project: Project) => void;
}

function Card({ project, index, position, rotation, onSelect }: FloatingCardProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const statusLedRef = useRef<THREE.Mesh>(null!);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    // Secondary micro-drift animation
    const floatY = Math.sin(t * 1.5 + index * 1.3) * 0.1;
    const targetScale = hovered ? 1.07 : 1.0;

    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 8
    );
    meshRef.current.position.y = position[1] + floatY;

    if (!hovered) {
      meshRef.current.rotation.y =
        rotation[1] + Math.sin(t * 0.7 + index) * 0.04;
      meshRef.current.rotation.x =
        rotation[0] + Math.cos(t * 0.6 + index) * 0.02;
    } else {
      // Precision mouse orientation on hover
      meshRef.current.rotation.y = THREE.MathUtils.damp(
        meshRef.current.rotation.y,
        rotation[1] + state.pointer.x * 0.28,
        7,
        delta
      );
      meshRef.current.rotation.x = THREE.MathUtils.damp(
        meshRef.current.rotation.x,
        rotation[0] - state.pointer.y * 0.2,
        7,
        delta
      );
    }

    // Status LED pulse
    if (statusLedRef.current) {
      const ledPulse = 1 + Math.sin(t * 5 + index) * 0.25;
      statusLedRef.current.scale.set(ledPulse, ledPulse, ledPulse);
    }
  });

  return (
    <group
      ref={meshRef}
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        playIndustrialClick();
        onSelect(project);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        playRadarPing();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* 1. Main Industrial Chassis Shell (#242424 / #1C1C1C) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.55, 1.52, 0.06]} />
        <meshStandardMaterial
          color={hovered ? "#282828" : "#202020"}
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>

      {/* 2. Recessed Holographic Center Panel */}
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[2.45, 1.42]} />
        <meshStandardMaterial
          color={hovered ? "#2D2622" : "#1A1A1A"}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* 3. Subtle Holographic Grid Texture on Card Surface */}
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[2.4, 1.38]} />
        <meshBasicMaterial
          color={hovered ? "#D95B28" : "#3D3D3D"}
          wireframe
          transparent
          opacity={hovered ? 0.35 : 0.15}
        />
      </mesh>

      {/* 4. Outer Dotted Border Frame */}
      <lineSegments position={[0, 0, 0.035]}>
        <edgesGeometry args={[new THREE.BoxGeometry(2.55, 1.52, 0.01)]} />
        <lineBasicMaterial
          color={hovered ? "#D95B28" : "#3D3D3D"}
          linewidth={2}
        />
      </lineSegments>

      {/* 5. Four Precision Industrial Corner Brackets */}
      {/* Top Left */}
      <mesh position={[-1.22, 0.7, 0.04]}>
        <planeGeometry args={[0.1, 0.02]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>
      <mesh position={[-1.26, 0.66, 0.04]}>
        <planeGeometry args={[0.02, 0.1]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>

      {/* Top Right */}
      <mesh position={[1.22, 0.7, 0.04]}>
        <planeGeometry args={[0.1, 0.02]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>
      <mesh position={[1.26, 0.66, 0.04]}>
        <planeGeometry args={[0.02, 0.1]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>

      {/* Bottom Left */}
      <mesh position={[-1.22, -0.7, 0.04]}>
        <planeGeometry args={[0.1, 0.02]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>
      <mesh position={[-1.26, -0.66, 0.04]}>
        <planeGeometry args={[0.02, 0.1]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>

      {/* Bottom Right */}
      <mesh position={[1.22, -0.7, 0.04]}>
        <planeGeometry args={[0.1, 0.02]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>
      <mesh position={[1.26, -0.66, 0.04]}>
        <planeGeometry args={[0.02, 0.1]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>

      {/* 6. Eyebrow 8x8 Accent Square */}
      <mesh position={[-1.02, 0.52, 0.045]}>
        <planeGeometry args={[0.055, 0.055]} />
        <meshBasicMaterial color={hovered ? "#D95B28" : "#8A8A8A"} />
      </mesh>

      {/* 7. Monospace Eyebrow Metadata */}
      <Text
        position={[-0.92, 0.52, 0.045]}
        fontSize={0.08}
        color={hovered ? "#D95B28" : "#8A8A8A"}
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.12}
      >
        {`[0${index + 1}] // ${project.company ? project.company.slice(0, 18).toUpperCase() : "SPATIAL ARCHITECTURE"}`}
      </Text>

      {/* 8. Title Text (White -> Signal Orange on hover) */}
      <Text
        position={[-1.02, 0.22, 0.045]}
        fontSize={0.165}
        color={hovered ? "#D95B28" : "#F0F0F0"}
        maxWidth={2.1}
        anchorX="left"
        anchorY="middle"
        letterSpacing={-0.02}
      >
        {project.title}
      </Text>

      {/* 9. Subtitle */}
      <Text
        position={[-1.02, -0.05, 0.045]}
        fontSize={0.095}
        color="#999999"
        maxWidth={2.1}
        anchorX="left"
        anchorY="middle"
      >
        {project.subtitle}
      </Text>

      {/* 10. Tags Readout */}
      <Text
        position={[-1.02, -0.38, 0.045]}
        fontSize={0.075}
        color={hovered ? "#EC7D42" : "#8A8A8A"}
        maxWidth={2.0}
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {project.tags.slice(0, 3).join(" • ")}
      </Text>

      {/* 11. Operational Status Pill with Blinking LED */}
      <group position={[0.92, -0.42, 0.045]}>
        {/* Pulsing Status LED */}
        <mesh ref={statusLedRef} position={[-0.22, 0, 0]}>
          <boxGeometry args={[0.045, 0.045, 0.02]} />
          <meshBasicMaterial color={hovered ? "#D95B28" : "#3A7A65"} />
        </mesh>
        <Text
          position={[-0.14, 0, 0]}
          fontSize={0.065}
          color={hovered ? "#D95B28" : "#3A7A65"}
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.08}
        >
          {hovered ? "INSPECT ▹" : "ACTIVE"}
        </Text>
      </group>
    </group>
  );
}

interface FloatingCardsProps {
  onSelectProject: (project: Project) => void;
}

export default function FloatingCards({ onSelectProject }: FloatingCardsProps) {
  const cardConfigs: {
    position: [number, number, number];
    rotation: [number, number, number];
  }[] = [
    { position: [1.25, 0.72, -0.3], rotation: [0.05, -0.2, 0.02] }, // CSPDCL Grid
    { position: [3.35, 0.72, -0.7], rotation: [0.06, -0.32, 0.03] }, // Track-Fields
    { position: [1.25, -0.58, -0.2], rotation: [-0.04, -0.18, -0.02] }, // KishanGuru
    { position: [3.35, -0.58, -0.6], rotation: [-0.05, -0.3, -0.02] }, // Solar Mapping
  ];

  return (
    <group position={[0, 0, 0]} scale={[0.92, 0.92, 0.92]}>
      {PROJECTS.map((project, i) => (
        <Card
          key={project.id}
          project={project}
          index={i}
          position={cardConfigs[i].position}
          rotation={cardConfigs[i].rotation}
          onSelect={onSelectProject}
        />
      ))}
    </group>
  );
}
