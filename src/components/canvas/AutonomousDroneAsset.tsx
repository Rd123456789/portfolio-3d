"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Project } from "@/lib/projects";

interface AutonomousDroneAssetProps {
  activeProject?: Project | null;
  position?: [number, number, number];
  scale?: number;
}

export default function AutonomousDroneAsset({
  activeProject,
  position = [0, 0, 0],
  scale = 1.0,
}: AutonomousDroneAssetProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const droneBodyRef = useRef<THREE.Group>(null!);
  const gimbalRef = useRef<THREE.Group>(null!);
  const laserConeRef = useRef<THREE.Mesh>(null!);
  const hudRingRef = useRef<THREE.Group>(null!);

  // Refs for 4 rotor blades
  const rotorRefs = [
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
  ];

  // Dynamic laser and accent color based on active project
  const themeColor = useMemo(() => {
    if (!activeProject) return "#FE6E00";
    if (activeProject.id === "cspdcl-grid-gis") return "#FE6E00"; // Signal Orange
    if (activeProject.id === "track-fields") return "#00C758"; // Eucalyptus
    if (activeProject.id === "kishanguru") return "#FFB74D"; // Ag Gold
    if (activeProject.id === "solar-mapping") return "#FF9100"; // Thermal Amber
    return "#38BDF8"; // Telemetry Cyan
  }, [activeProject]);

  // Arm angles for quadcopter configuration (45°, 135°, 225°, 315°)
  const armConfigs = [
    { x: 1.15, z: 1.15, angle: Math.PI / 4, dir: 1 },
    { x: -1.15, z: 1.15, angle: (3 * Math.PI) / 4, dir: -1 },
    { x: -1.15, z: -1.15, angle: (5 * Math.PI) / 4, dir: 1 },
    { x: 1.15, z: -1.15, angle: (7 * Math.PI) / 4, dir: -1 },
  ];

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Aerodynamic Hover Bobbing & Banking
    if (droneBodyRef.current) {
      const hoverY = Math.sin(t * 1.8) * 0.08 + Math.cos(t * 2.6) * 0.03;
      droneBodyRef.current.position.y = hoverY;

      // Realistic drone flight bank towards cursor with forward pitch for 3D visibility
      const targetRoll = -state.pointer.x * 0.22;
      const targetPitch = 0.36 + state.pointer.y * 0.18;
      const targetYaw = -0.2 + Math.sin(t * 0.4) * 0.12 - state.pointer.x * 0.15;

      droneBodyRef.current.rotation.z = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.z,
        targetRoll,
        4,
        delta
      );
      droneBodyRef.current.rotation.x = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.x,
        targetPitch,
        4,
        delta
      );
      droneBodyRef.current.rotation.y = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.y,
        targetYaw,
        3,
        delta
      );
    }

    // 2. High-Speed Rotor Blade Rotation (blur speed)
    rotorRefs.forEach((ref, idx) => {
      if (ref.current) {
        const dir = armConfigs[idx].dir;
        ref.current.rotation.y += delta * 42 * dir;
      }
    });

    // 3. Articulated 3-Axis Gimbal tracks cursor dynamically
    if (gimbalRef.current) {
      const targetGimbalPitch = -0.4 - state.pointer.y * 0.4;
      const targetGimbalYaw = state.pointer.x * 0.5;

      gimbalRef.current.rotation.x = THREE.MathUtils.damp(
        gimbalRef.current.rotation.x,
        targetGimbalPitch,
        6,
        delta
      );
      gimbalRef.current.rotation.y = THREE.MathUtils.damp(
        gimbalRef.current.rotation.y,
        targetGimbalYaw,
        6,
        delta
      );
    }

    // 4. LIDAR Laser Scanning Pulse
    if (laserConeRef.current) {
      laserConeRef.current.rotation.y += delta * 0.8;
      const scalePulse = 1 + Math.sin(t * 6) * 0.08;
      laserConeRef.current.scale.x = scalePulse;
      laserConeRef.current.scale.z = scalePulse;
    }

    // 5. Telemetry HUD Compass Ring slow rotation
    if (hudRingRef.current) {
      hudRingRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group ref={rootGroupRef} position={position} scale={scale}>
      {/* Dedicated Drone Studio Lights */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 4]} intensity={5.0} color="#FFFFFF" />
      <pointLight position={[0, 2.5, 2.5]} intensity={5.5} color="#FFFFFF" distance={10} />
      <pointLight position={[-2, 1, 0]} intensity={4.5} color={themeColor} distance={8} />
      <pointLight position={[2, -1, 1]} intensity={3.0} color="#FFB74D" distance={6} />

      {/* =========================================================================
          DRONE CHASSIS & AVIONICS FUSELAGE
      ========================================================================= */}
      <group ref={droneBodyRef}>
        {/* 1. Core Carbon Avionics Pod */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.9, 0.28, 1.25]} />
          <meshStandardMaterial
            color="#22201E"
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* 2. Top Aerodynamic Shell with Beveled Profile */}
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.75, 0.12, 1.05]} />
          <meshStandardMaterial
            color="#181818"
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>

        {/* 3. Signal Orange Brand Accent Inset Ribs */}
        <mesh position={[0, 0.22, -0.05]}>
          <boxGeometry args={[0.2, 0.03, 0.6]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        {/* 4. RTK / GNSS High-Precision Dual Antennas */}
        <mesh position={[0.24, 0.25, 0.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
          <meshStandardMaterial color="#3D3D3D" metalness={0.9} />
        </mesh>
        <mesh position={[0.24, 0.29, 0.3]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        <mesh position={[-0.24, 0.25, 0.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 16]} />
          <meshStandardMaterial color="#3D3D3D" metalness={0.9} />
        </mesh>
        <mesh position={[-0.24, 0.29, 0.3]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        {/* 5. Autonomous Navigation Forward Stereo Sensors */}
        <mesh position={[0.22, 0.04, -0.63]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#0A0A0A" roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[-0.22, 0.04, -0.63]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#0A0A0A" roughness={0.1} metalness={0.9} />
        </mesh>

        {/* 6. Landing Skids (Left & Right Carbon Tubes) */}
        {/* Left Skid */}
        <group position={[-0.55, -0.4, 0]}>
          {/* Horizontal Rail */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.4, 8]} />
            <meshStandardMaterial color="#1C1C1C" metalness={0.8} />
          </mesh>
          {/* Vertical Struts */}
          <mesh position={[0, 0.2, 0.35]} rotation={[0, 0, -0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.2, -0.35]} rotation={[0, 0, -0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
        </group>

        {/* Right Skid */}
        <group position={[0.55, -0.4, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.4, 8]} />
            <meshStandardMaterial color="#1C1C1C" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.2, 0.35]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.2, -0.35]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
        </group>

        {/* 7. Carbon-Fiber Booms & Motor Pods (4 Arms) */}
        {armConfigs.map((arm, i) => (
          <group key={i}>
            {/* Tubular Carbon Arm */}
            <mesh
              position={[arm.x * 0.5, 0.05, arm.z * 0.5]}
              rotation={[0, -arm.angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.035, 0.04, 1.35, 12]} />
              <meshStandardMaterial
                color="#1F1D1B"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>

            {/* Brushless Motor Can */}
            <mesh position={[arm.x, 0.12, arm.z]}>
              <cylinderGeometry args={[0.09, 0.09, 0.14, 16]} />
              <meshStandardMaterial
                color="#FE6E00"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>

            {/* Motor Base Mount Bracket */}
            <mesh position={[arm.x, 0.03, arm.z]}>
              <cylinderGeometry args={[0.11, 0.11, 0.06, 16]} />
              <meshStandardMaterial color="#1A1A1A" metalness={0.9} />
            </mesh>

            {/* High-Speed Spinning Carbon Rotor Blades */}
            <group ref={rotorRefs[i]} position={[arm.x, 0.21, arm.z]}>
              {/* Spinner Hub */}
              <mesh>
                <cylinderGeometry args={[0.035, 0.045, 0.06, 12]} />
                <meshStandardMaterial color="#D6D6D6" metalness={0.9} />
              </mesh>
              {/* Rotor Blade 1 */}
              <mesh position={[0.42, 0, 0]} rotation={[0.08 * arm.dir, 0, 0]}>
                <boxGeometry args={[0.82, 0.012, 0.095]} />
                <meshStandardMaterial
                  color="#151515"
                  roughness={0.2}
                  metalness={0.8}
                  transparent
                  opacity={0.85}
                />
              </mesh>
              {/* Rotor Blade 2 */}
              <mesh position={[-0.42, 0, 0]} rotation={[-0.08 * arm.dir, 0, 0]}>
                <boxGeometry args={[0.82, 0.012, 0.095]} />
                <meshStandardMaterial
                  color="#151515"
                  roughness={0.2}
                  metalness={0.8}
                  transparent
                  opacity={0.85}
                />
              </mesh>
              {/* Spinning Disc Tip Glow Blur */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.82, 0.008, 6, 24]} />
                <meshBasicMaterial
                  color={themeColor}
                  transparent
                  opacity={0.25}
                />
              </mesh>
            </group>
          </group>
        ))}

        {/* 8. 3-Axis Stabilized Gimbal & Optical Payload (Under Nose) */}
        <group ref={gimbalRef} position={[0, -0.22, -0.42]}>
          {/* Gimbal Yaw Base */}
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.9} />
          </mesh>

          {/* Gimbal Pitch Fork Arm */}
          <mesh position={[0, -0.08, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.05]} />
            <meshStandardMaterial color="#1F1F1F" metalness={0.9} />
          </mesh>

          {/* Camera Turret Body */}
          <mesh position={[0, -0.15, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial
              color="#141414"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Primary High-Resolution Optical Inspection Lens */}
          <mesh position={[0.04, -0.15, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.06, 16]} />
            <meshStandardMaterial color="#D95B28" metalness={0.9} />
          </mesh>
          <mesh position={[0.04, -0.15, -0.155]}>
            <circleGeometry args={[0.038, 16]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>

          {/* Secondary Thermal / Multispectral Sensor Lens */}
          <mesh position={[-0.05, -0.15, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 16]} />
            <meshStandardMaterial color="#8A8A8A" metalness={0.9} />
          </mesh>
          <mesh position={[-0.05, -0.15, -0.135]}>
            <circleGeometry args={[0.025, 16]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>

          {/* Active LIDAR Laser Scanning Cone */}
          <mesh
            ref={laserConeRef}
            position={[0, -1.8, 0]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[1.5, 3.2, 16, 1, true]} />
            <meshBasicMaterial
              color={themeColor}
              wireframe
              transparent
              opacity={0.18}
            />
          </mesh>

          {/* Ground Projection Telemetry Ring */}
          <mesh position={[0, -3.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.3, 1.45, 24]} />
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.35}
            />
          </mesh>
        </group>
      </group>

      {/* =========================================================================
          SPATIAL FLIGHT TELEMETRY HUD OVERLAYS (COMMAND CENTER PROTOCOL)
      ========================================================================= */}
      <group ref={hudRingRef} position={[0, -0.1, 0]}>
        {/* Orbital Azimuth Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.2, 0.008, 8, 48]} />
          <meshBasicMaterial
            color={themeColor}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* 4 Cardinal Tick Marks */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
          <mesh
            key={i}
            position={[
              2.2 * Math.cos(angle),
              0,
              2.2 * Math.sin(angle),
            ]}
          >
            <boxGeometry args={[0.08, 0.015, 0.08]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
