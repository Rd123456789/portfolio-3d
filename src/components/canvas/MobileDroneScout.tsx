"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Project } from "@/lib/projects";

interface MobileDroneScoutProps {
  activeProject?: Project | null;
  position?: [number, number, number];
  scale?: number;
}

export default function MobileDroneScout({
  activeProject,
  position = [0, 0, 0],
  scale = 1.0,
}: MobileDroneScoutProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const droneBodyRef = useRef<THREE.Group>(null!);
  const sensorTurretRef = useRef<THREE.Group>(null!);
  const lidarRingsRef = useRef<THREE.Group>(null!);
  const groundRingsRef = useRef<THREE.Group>(null!);
  const strobeTailRef = useRef<THREE.MeshBasicMaterial>(null!);
  const navRedRef = useRef<THREE.MeshBasicMaterial>(null!);
  const navGreenRef = useRef<THREE.MeshBasicMaterial>(null!);

  // 4 high-speed spinning rotor blade refs
  const rotorRefs = [
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
  ];

  // Dynamic tactical accent color based on active project
  const themeColor = useMemo(() => {
    if (!activeProject) return "#FE6E00";
    if (activeProject.id === "cspdcl-grid-gis") return "#FE6E00"; // Signal Orange
    if (activeProject.id === "track-fields") return "#00C758"; // Eucalyptus Green
    if (activeProject.id === "kishanguru") return "#FFB74D"; // Ag Gold
    if (activeProject.id === "solar-mapping") return "#FF9100"; // Thermal Amber
    return "#38BDF8"; // Telemetry Cyan
  }, [activeProject]);

  // Arm positions and rotations (X-Quadcopter configuration)
  const armConfigs = [
    { x: 0.95, z: 0.95, angle: Math.PI / 4, dir: 1, isPort: true }, // Rear-Left
    { x: -0.95, z: 0.95, angle: (3 * Math.PI) / 4, dir: -1, isPort: false }, // Rear-Right
    { x: -0.95, z: -0.95, angle: (5 * Math.PI) / 4, dir: 1, isPort: false }, // Front-Right
    { x: 0.95, z: -0.95, angle: (7 * Math.PI) / 4, dir: -1, isPort: true }, // Front-Left
  ];

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Aerodynamic Hover Dynamics & Smooth Touch Tilting
    if (droneBodyRef.current) {
      // Natural flight turbulence bobbing
      const hoverY = Math.sin(t * 2.4) * 0.045 + Math.cos(t * 3.8) * 0.015;
      droneBodyRef.current.position.y = hoverY;

      // Responsive touch tilt with forward camera pitch
      const targetRotY = state.pointer.x * 0.45 + Math.sin(t * 0.5) * 0.08;
      const targetRotX = 0.42 - state.pointer.y * 0.28; // Forward isometric rake
      const targetRotZ = -state.pointer.x * 0.25; // Bank into roll

      droneBodyRef.current.rotation.y = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.y,
        targetRotY,
        5,
        delta
      );
      droneBodyRef.current.rotation.x = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.x,
        targetRotX,
        5,
        delta
      );
      droneBodyRef.current.rotation.z = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.z,
        targetRotZ,
        5,
        delta
      );
    }

    // 2. High-speed Propeller Rotation (blur physics)
    rotorRefs.forEach((ref, idx) => {
      if (ref.current) {
        ref.current.rotation.y += delta * 46 * armConfigs[idx].dir;
      }
    });

    // 3. Sensor Gimbal Active Inspection Tracking
    if (sensorTurretRef.current) {
      const targetGimbalPitch = -0.35 + state.pointer.y * 0.3;
      const targetGimbalYaw = -state.pointer.x * 0.45 + Math.sin(t * 1.2) * 0.15;

      sensorTurretRef.current.rotation.x = THREE.MathUtils.damp(
        sensorTurretRef.current.rotation.x,
        targetGimbalPitch,
        6,
        delta
      );
      sensorTurretRef.current.rotation.y = THREE.MathUtils.damp(
        sensorTurretRef.current.rotation.y,
        targetGimbalYaw,
        6,
        delta
      );
    }

    // 4. Volumetric LiDAR Scan Ring Animation
    if (lidarRingsRef.current) {
      lidarRingsRef.current.rotation.y += delta * 1.2;
    }

    // 5. Dynamic Ground Ripple Waves
    if (groundRingsRef.current) {
      const pulseScale = 1.0 + ((t * 0.8) % 1.0) * 0.45;
      groundRingsRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }

    // 6. Navigation Strobe Light Pulses (FAA standard anti-collision)
    if (strobeTailRef.current) {
      // Rapid double flash every 1.2 seconds
      const cycle = t % 1.2;
      const isFlash = (cycle > 0.0 && cycle < 0.08) || (cycle > 0.16 && cycle < 0.24);
      strobeTailRef.current.opacity = isFlash ? 1.0 : 0.05;
    }
  });

  return (
    <group ref={rootGroupRef} position={position} scale={scale}>
      {/* =========================================================================
          HIGH-FIDELITY MOBILE STUDIO LIGHTING
      ========================================================================= */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 5, 4]} intensity={5.5} color="#FFFFFF" />
      <directionalLight position={[-3, -2, -2]} intensity={2.0} color="#FE6E00" />
      <pointLight position={[0, 2.5, 2.0]} intensity={5.0} color="#FFFFFF" distance={10} />
      <pointLight position={[0, -1.2, 1.2]} intensity={4.0} color={themeColor} distance={8} />

      {/* =========================================================================
          MAIN SCOUT DRONE CHASSIS & AVIONICS
      ========================================================================= */}
      <group ref={droneBodyRef}>
        {/* 1. Core Carbon Monocoque Lower Hull */}
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[0.74, 0.22, 1.05]} />
          <meshStandardMaterial
            color="#1E1E1E"
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>

        {/* 2. Top Aerodynamic Armored Canopy */}
        <mesh position={[0, 0.12, 0.02]}>
          <boxGeometry args={[0.62, 0.12, 0.85]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>

        {/* 3. Signal Orange Brand Aerodynamic Spine */}
        <mesh position={[0, 0.19, 0.02]}>
          <boxGeometry args={[0.16, 0.04, 0.65]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        {/* 4. Avionics Cooling Louvers / Heat Dissipation Gills */}
        {[-0.15, 0, 0.15].map((zOffset, idx) => (
          <mesh key={idx} position={[0.24, 0.14, zOffset]}>
            <boxGeometry args={[0.04, 0.02, 0.08]} />
            <meshStandardMaterial color="#3D3D3D" metalness={0.9} />
          </mesh>
        ))}
        {[-0.15, 0, 0.15].map((zOffset, idx) => (
          <mesh key={idx} position={[-0.24, 0.14, zOffset]}>
            <boxGeometry args={[0.04, 0.02, 0.08]} />
            <meshStandardMaterial color="#3D3D3D" metalness={0.9} />
          </mesh>
        ))}

        {/* 5. Dual High-Precision RTK GNSS Antenna Masts */}
        <group position={[0.18, 0.22, 0.26]}>
          <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} />
          <meshStandardMaterial color="#2E2E2E" metalness={0.9} />
          <mesh position={[0, 0.045, 0]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>
        </group>
        <group position={[-0.18, 0.22, 0.26]}>
          <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} />
          <meshStandardMaterial color="#2E2E2E" metalness={0.9} />
          <mesh position={[0, 0.045, 0]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>
        </group>

        {/* 6. Forward Stereoscopic Optical Vision Eyes */}
        <mesh position={[0.18, 0.04, -0.53]}>
          <cylinderGeometry args={[0.035, 0.035, 0.04, 16]} />
          <meshStandardMaterial color="#FE6E00" metalness={0.8} />
        </mesh>
        <mesh position={[0.18, 0.04, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>

        <mesh position={[-0.18, 0.04, -0.53]}>
          <cylinderGeometry args={[0.035, 0.035, 0.04, 16]} />
          <meshStandardMaterial color="#FE6E00" metalness={0.8} />
        </mesh>
        <mesh position={[-0.18, 0.04, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>

        {/* 7. Carbon Skid Landing Gear */}
        {/* Left Skid */}
        <group position={[-0.42, -0.28, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.15, 8]} />
            <meshStandardMaterial color="#1A1A1A" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.14, 0.28]} rotation={[0, 0, -0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.32, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.14, -0.28]} rotation={[0, 0, -0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.32, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
        </group>
        {/* Right Skid */}
        <group position={[0.42, -0.28, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.15, 8]} />
            <meshStandardMaterial color="#1A1A1A" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.14, 0.28]} rotation={[0, 0, 0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.32, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.14, -0.28]} rotation={[0, 0, 0.22]}>
            <cylinderGeometry args={[0.015, 0.015, 0.32, 8]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.8} />
          </mesh>
        </group>

        {/* 8. Tail Anti-Collision Strobe Beacon */}
        <mesh position={[0, 0.08, 0.54]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial ref={strobeTailRef} color="#FFFFFF" transparent />
        </mesh>

        {/* 9. Four Carbon Fiber Booms & High-Speed Brushless Motors */}
        {armConfigs.map((arm, i) => (
          <group key={i}>
            {/* Carbon Structural Boom */}
            <mesh
              position={[arm.x * 0.5, 0.02, arm.z * 0.5]}
              rotation={[0, -arm.angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.03, 0.035, 1.15, 12]} />
              <meshStandardMaterial
                color="#1C1A18"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>

            {/* Brushless Motor Outrunner Can (Anodized Orange Base + Machined Top) */}
            <mesh position={[arm.x, 0.08, arm.z]}>
              <cylinderGeometry args={[0.085, 0.085, 0.12, 16]} />
              <meshStandardMaterial
                color="#FE6E00"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>

            {/* Internal Copper Coil Stator Accent Ring */}
            <mesh position={[arm.x, 0.04, arm.z]}>
              <cylinderGeometry args={[0.095, 0.095, 0.04, 16]} />
              <meshStandardMaterial color="#242424" metalness={0.9} />
            </mesh>

            {/* FAA Navigation Wingtip LEDs */}
            <mesh position={[arm.x * 1.12, 0.06, arm.z * 1.12]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial
                color={arm.isPort ? "#FF2A2A" : "#00E676"}
              />
            </mesh>

            {/* High-Velocity Spinning Rotor Assemblies */}
            <group ref={rotorRefs[i]} position={[arm.x, 0.16, arm.z]}>
              {/* CNC Spinner Nut */}
              <mesh>
                <cylinderGeometry args={[0.028, 0.038, 0.05, 12]} />
                <meshStandardMaterial color="#E0E0E0" metalness={0.9} />
              </mesh>

              {/* Carbon Aerofoil Blade 1 */}
              <mesh position={[0.36, 0, 0]} rotation={[0.08 * arm.dir, 0, 0]}>
                <boxGeometry args={[0.72, 0.012, 0.085]} />
                <meshStandardMaterial
                  color="#161616"
                  roughness={0.2}
                  metalness={0.8}
                  transparent
                  opacity={0.88}
                />
              </mesh>

              {/* Carbon Aerofoil Blade 2 */}
              <mesh position={[-0.36, 0, 0]} rotation={[-0.08 * arm.dir, 0, 0]}>
                <boxGeometry args={[0.72, 0.012, 0.085]} />
                <meshStandardMaterial
                  color="#161616"
                  roughness={0.2}
                  metalness={0.8}
                  transparent
                  opacity={0.88}
                />
              </mesh>

              {/* Rotor Tip Velocity Blur Disk with Glowing Edge */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.66, 0.74, 24]} />
                <meshBasicMaterial
                  color={themeColor}
                  transparent
                  opacity={0.28}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </group>
        ))}

        {/* 10. Articulated Inspection Sensor Gimbal Turret (Under Nose) */}
        <group ref={sensorTurretRef} position={[0, -0.16, -0.34]}>
          {/* Motorized Turret Base */}
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.9} />
          </mesh>

          {/* Gimbal Sphere Enclosure */}
          <mesh position={[0, -0.1, 0]}>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial
              color="#141414"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>

          {/* Primary 4K Optical Inspection Lens */}
          <mesh position={[0.035, -0.1, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.04, 16]} />
            <meshStandardMaterial color="#D95B28" metalness={0.9} />
          </mesh>
          <mesh position={[0.035, -0.1, -0.125]}>
            <circleGeometry args={[0.03, 16]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>

          {/* Secondary Thermal IR Aperture */}
          <mesh position={[-0.035, -0.1, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.03, 16]} />
            <meshStandardMaterial color="#8A8A8A" metalness={0.9} />
          </mesh>
          <mesh position={[-0.035, -0.1, -0.11]}>
            <circleGeometry args={[0.02, 16]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>

          {/* Volumetric Holographic LiDAR Laser Cone */}
          <mesh position={[0, -0.85, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.85, 1.45, 16, 2, true]} />
            <meshBasicMaterial
              color={themeColor}
              wireframe
              transparent
              opacity={0.22}
            />
          </mesh>
        </group>
      </group>

      {/* =========================================================================
          SPATIAL TACTICAL HUD TELEMETRY RINGS (3D MOBILE STAGE)
      ========================================================================= */}
      {/* 1. Compass Azimuth Ring Surrounding the Scout */}
      <group ref={lidarRingsRef} position={[0, -0.08, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.75, 0.007, 6, 48]} />
          <meshBasicMaterial
            color={themeColor}
            transparent
            opacity={0.35}
          />
        </mesh>
        {/* Cardinal Ticks */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
          <mesh
            key={i}
            position={[1.75 * Math.cos(angle), 0, 1.75 * Math.sin(angle)]}
          >
            <boxGeometry args={[0.06, 0.01, 0.06]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>
        ))}
      </group>

      {/* 2. Projected Ground Coordinate Ripple Rings */}
      <group ref={groundRingsRef} position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 0.85, 32]} />
        <meshBasicMaterial
          color={themeColor}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
        />
      </group>
      <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.42, 24]} />
        <meshBasicMaterial
          color={themeColor}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
