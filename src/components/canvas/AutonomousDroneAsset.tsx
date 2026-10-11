"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Project } from "@/lib/projects";
import { createDiscMaterial, tickDiscMaterial } from "@/lib/shaders";

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

  // Planned photo stations along the first swath, with capture state driven by
  // the mission clock — the shutter fires as the aircraft reaches each station.
  const photoStations = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        phase: i / 5,
      })),
    []
  );
  const photoStationRefs = useRef<THREE.Mesh[]>([]);
  const scanPoolRef = useRef<THREE.Mesh>(null!);
  const hudRingRef = useRef<THREE.Group>(null!);
  const hudSweepRef = useRef<THREE.Mesh>(null!);
  const reticleRef = useRef<THREE.Group>(null!);
  const coverageRingRef = useRef<THREE.Mesh>(null!);

  // Failsafe return-to-home route: a polyline from the farthest survey extent
  // back to the launch point, kinked so it reads as a contingency path.
  const homeReturnPath = useMemo(() => {
    const pts: number[] = [];
    pts.push(0, 0, -1.3, 0.35, 0, -0.4, 0, 0, 0.6, 0, 0, 1.5);
    return new Float32Array(pts);
  }, []);

  // One travelling air ring per rotor (rotor downwash visualisation)
  const downwashRefs = [
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
  ];

  // Survey plan: a lawnmower (boustrophedon) flight pattern laid out in the
  // ground plane under the aircraft. Swaths run along Z, the aircraft transits
  // along X between them — exactly how a photogrammetry or LiDAR mission is
  // planned. The pattern is centred on the origin so the LiDAR footprint stays
  // inside it.
  const surveyPlan = useMemo(() => {
    const swathCount = 7;
    const swathWidth = 0.62;
    const swathLength = 2.6;
    const swaths: { x: number; index: number }[] = [];
    for (let i = 0; i < swathCount; i++) {
      swaths.push({ x: (i - (swathCount - 1) / 2) * swathWidth, index: i });
    }

    return {
      swaths,
      swathLength,
      swathWidth,
      totalWidth: (swathCount - 1) * swathWidth,
    };
  }, []);

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

  // One shared blade-blur material for all four rotors: a radial-gradient disc
  // with rotating streaks, so props read as spinning instead of static rings.
  const rotorBlurMaterial = useMemo(
    () => createDiscMaterial({ color: themeColor, intensity: 0.5, streaks: 4 }),
    [themeColor]
  );

  useEffect(() => () => rotorBlurMaterial.dispose(), [rotorBlurMaterial]);

  // Soft pool of light on the "ground" beneath the airframe
  const groundWashMaterial = useMemo(
    () => createDiscMaterial({ color: themeColor, intensity: 0.4 }),
    [themeColor]
  );

  // Orientation that aims the designator beam from the lens to the survey point
  const designatorQuaternion = useMemo(() => {
    const axis = new THREE.Vector3(-0.04, -1.47, 0.155).normalize();
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      axis
    );
  }, []);

  useEffect(() => () => groundWashMaterial.dispose(), [groundWashMaterial]);

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

    // Keep the blade-blur streaks spinning on every rotor (one shared material)
    tickDiscMaterial(rotorBlurMaterial, t);

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

    // 4. LiDAR scan pool on the ground: a circular spot that breathes, so the
    // payload still reads as actively ranging without a wireframe mesh.
    if (scanPoolRef.current) {
      const pulse = 1 + Math.sin(t * 2.4) * 0.12;
      scanPoolRef.current.scale.setScalar(pulse);
      const mat = scanPoolRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + Math.abs(Math.sin(t * 1.6)) * 0.16;
    }

    // 5. Telemetry HUD Compass Ring slow rotation
    if (hudRingRef.current) {
      hudRingRef.current.rotation.y += delta * 0.2;
    }

    // HUD radar sweep: leading edge traces the ring, trailing edge fades out
    if (hudSweepRef.current) {
      hudSweepRef.current.rotation.z += delta * 1.4;
      const mat = hudSweepRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.abs(Math.sin(t * 0.9)) * 0.45;
    }

    // Survey execution: the aircraft sweeps the plan, and the ground ring
    // sweeps outward with it as a coverage indicator.
    {
      const cyclePos = (t * 0.16) % 1;
      const swathIndex = Math.min(
        surveyPlan.swaths.length - 1,
        Math.floor(cyclePos * surveyPlan.swaths.length)
      );
      const alongSwath = (cyclePos * surveyPlan.swaths.length) % 1;
      const swathX = surveyPlan.swaths[swathIndex].x;

      if (coverageRingRef.current) {
        // Ring grows through the swath, then snaps back for the next one
        const sweep = 0.85 + alongSwath * 0.5;
        coverageRingRef.current.scale.setScalar(sweep);
        const mat = coverageRingRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.55 - alongSwath * 0.3;
      }

      // The airframe banks into the flight path, so it is visibly flying the
      // plan rather than hovering decoratively.
      if (droneBodyRef.current) {
        const hoverY = Math.sin(t * 2.2) * 0.012;
        droneBodyRef.current.position.x = swathX * 0.55;
        droneBodyRef.current.position.y = hoverY;
        // Roll toward the active swath, plus a pitch that follows travel speed
        droneBodyRef.current.rotation.z = swathX * 0.14 + Math.sin(t * 0.7) * 0.025;
        droneBodyRef.current.rotation.x = -0.06 + Math.sin(t * 0.5) * 0.02;
      }

      // Photo stations: the shutter drops as the aircraft crosses each station
      photoStationRefs.current.forEach((mesh, i) => {
        if (!mesh) return;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const stationProgress = photoStations[i].phase;
        const covered = alongSwath >= stationProgress;
        // A brief bright pulse exactly at capture time
        const nearCapture = Math.abs(alongSwath - stationProgress) < 0.035;
        mat.opacity = covered ? (nearCapture ? 1.0 : 0.75) : 0.22;
      });
    }

    // 6. Rotor downwash: each motor throws a travelling air ring beneath it
    rotorRefs.forEach((ref, i) => {
      const ring = downwashRefs[i].current;
      if (!ref.current || !ring) return;
      const phase = (t * 2.2 + i * 0.25) % 1;
      ring.position.y = ref.current.position.y + 0.2 - phase * 0.55;
      ring.scale.setScalar(0.75 + phase * 0.9);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.22 * (1 - phase);
    });
  });

  return (
    <group ref={rootGroupRef} position={position} scale={scale}>
      {/* Scene-wide Lighting.tsx carries the exposure; a single accent light keeps the
          chassis readable without adding another per-fragment light cost. */}
      <pointLight
        position={[-2, 1, 0]}
        intensity={4.5}
        color={themeColor}
        distance={8}
      />

      {/* =========================================================================
          DRONE CHASSIS & AVIONICS FUSELAGE
      ========================================================================= */}
      <group ref={droneBodyRef}>
        {/* 1. Core Carbon Avionics Pod */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.9, 0.28, 1.25]} />
          <meshStandardMaterial
            color="#22201E"
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* Rim-light edges. A wireframe shell was tried here and read as a
            cage rather than a hull, so the silhouette is traced with emissive
            panel edges instead: top outboard rails plus the underside keel. */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.44, 0.08, 0]}>
            <boxGeometry args={[0.016, 0.016, 1.22]} />
            <meshStandardMaterial
              color={themeColor}
              emissive={themeColor}
              emissiveIntensity={2.6}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.78, 0.014, 0.014]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={1.8}
          />
        </mesh>

        {/* Radiator / vent panel on the flank, so the hull is not a blank slab */}
        {[-1, 1].map((side) => (
          <mesh key={`vent-${side}`} position={[side * 0.452, 0.06, 0.1]}>
            <boxGeometry args={[0.006, 0.1, 0.34]} />
            <meshStandardMaterial
              color="#111111"
              metalness={0.9}
              roughness={0.5}
            />
          </mesh>
        ))}

        {/* 2. Top Aerodynamic Shell with Beveled Profile */}
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.75, 0.12, 1.05]} />
          <meshStandardMaterial
            color="#181818"
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>

        {/* Emissive crown strip along the shell's forward edge */}
        <mesh position={[0, 0.22, -0.5]}>
          <boxGeometry args={[0.73, 0.02, 0.03]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={4}
          />
        </mesh>
        <mesh position={[0, 0.02, 0.6]}>
          <boxGeometry args={[0.73, 0.02, 0.03]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={1.5}
          />
        </mesh>

        {/* 3. Signal Orange Brand Accent Inset Ribs */}
        <mesh position={[0, 0.22, -0.05]}>
          <boxGeometry args={[0.2, 0.03, 0.6]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        {/* Apex status strobe */}
        <mesh position={[0, 0.3, 0.15]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={themeColor}
            emissiveIntensity={6}
          />
        </mesh>

        {/* Flight battery pack with charge-bar state indicators */}
        <group position={[0.0, -0.16, 0.25]}>
          <mesh>
            <boxGeometry args={[0.34, 0.09, 0.2]} />
            <meshStandardMaterial
              color="#1C1C1C"
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
          {[0, 1, 2, 3].map((b) => (
            <mesh key={b} position={[-0.105 + b * 0.07, -0.045, 0.1]}>
              <boxGeometry args={[0.05, 0.012, 0.006]} />
              <meshStandardMaterial
                color={b === 3 ? "#00C758" : "#FE6E00"}
                emissive={b === 3 ? "#00C758" : "#FE6E00"}
                emissiveIntensity={4}
              />
            </mesh>
          ))}
        </group>

        {/* Whip telemetry antenna */}
        <mesh position={[-0.36, 0.22, -0.3]}>
          <cylinderGeometry args={[0.003, 0.003, 0.4, 4]} />
          <meshStandardMaterial color="#1A1A1A" metalness={0.9} />
        </mesh>
        <mesh position={[-0.36, 0.44, -0.3]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>

        {/* 4. RTK / GNSS High-Precision Dual Antennas */}
        <mesh position={[0.24, 0.25, 0.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 10]} />
          <meshStandardMaterial color="#3D3D3D" metalness={0.9} />
        </mesh>
        <mesh position={[0.24, 0.29, 0.3]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        <mesh position={[-0.24, 0.25, 0.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 10]} />
          <meshStandardMaterial color="#3D3D3D" metalness={0.9} />
        </mesh>
        <mesh position={[-0.24, 0.29, 0.3]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>

        {/* 5. Autonomous Navigation Forward Stereo Sensors */}
        <mesh position={[0.22, 0.04, -0.63]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#0A0A0A" roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[-0.22, 0.04, -0.63]}>
          <sphereGeometry args={[0.035, 8, 8]} />
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

            {/* Leading-edge light strip: reads the X plan-form against the void */}
            <mesh
              position={[arm.x * 0.5, 0.115, arm.z * 0.5]}
              rotation={[0, -arm.angle, Math.PI / 2]}
            >
              <boxGeometry args={[0.018, 1.34, 0.01]} />
              <meshStandardMaterial
                color={themeColor}
                emissive={themeColor}
                emissiveIntensity={2.4}
              />
            </mesh>

            {/* Brushless Motor Can */}
            <mesh position={[arm.x, 0.12, arm.z]}>
              <cylinderGeometry args={[0.09, 0.09, 0.14, 10]} />
              <meshStandardMaterial
                color="#FE6E00"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>

            {/* Motor Base Mount Bracket */}
            <mesh position={[arm.x, 0.03, arm.z]}>
              <cylinderGeometry args={[0.11, 0.11, 0.06, 10]} />
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
              {/* Spinning Disc Blade-Blur Field (radial-gradient shader disc) */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.86, 28]} />
                <primitive object={rotorBlurMaterial} attach="material" />
              </mesh>

              {/* Travelling downwash ring thrown by this motor */}
              <mesh ref={downwashRefs[i]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 0.34, 20]} />
                <meshBasicMaterial
                  color={themeColor}
                  transparent
                  opacity={0.2}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          </group>
        ))}

        {/* 8. 3-Axis Stabilized Gimbal & Optical Payload (Under Nose) */}
        <group ref={gimbalRef} position={[0, -0.22, -0.42]}>
          {/* Gimbal Yaw Base */}
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 10]} />
            <meshStandardMaterial color="#2E2E2E" metalness={0.9} />
          </mesh>

          {/* Gimbal Pitch Fork Arm */}
          <mesh position={[0, -0.08, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.05]} />
            <meshStandardMaterial color="#1F1F1F" metalness={0.9} />
          </mesh>

          {/* Camera Turret Body */}
          <mesh position={[0, -0.15, 0]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial
              color="#141414"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Primary High-Resolution Optical Inspection Lens */}
          <mesh position={[0.04, -0.15, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.06, 10]} />
            <meshStandardMaterial color="#D95B28" metalness={0.9} />
          </mesh>
          <mesh position={[0.04, -0.15, -0.155]}>
            <circleGeometry args={[0.038, 16]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>
          {/* Lens barrel glow ring */}
          <mesh position={[0.04, -0.15, -0.152]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.044, 0.004, 6, 16]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.7} />
          </mesh>

          {/* Secondary Thermal / Multispectral Sensor Lens */}
          <mesh position={[-0.05, -0.15, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 10]} />
            <meshStandardMaterial color="#8A8A8A" metalness={0.9} />
          </mesh>
          <mesh position={[-0.05, -0.15, -0.135]}>
            <circleGeometry args={[0.025, 16]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>

          {/* Active laser designator: optical boresight down to the survey point */}
          <mesh
            position={[0.02, -0.885, -0.078]}
            quaternion={designatorQuaternion}
          >
            <cylinderGeometry args={[0.0035, 0.0035, 1.48, 5]} />
            <meshBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Ground survey point: designator dot plus pulsing lock-on brackets */}
          <mesh position={[0, -1.617, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.026, 12]} />
            <meshBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          <group ref={reticleRef} position={[0, -1.616, 0]}>
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <group
                  key={`${sx}-${sz}`}
                  position={[sx * 0.075, 0, sz * 0.075]}
                >
                  <mesh position={[sx * -0.045, 0, 0]}>
                    <boxGeometry args={[0.09, 0.004, 0.008]} />
                    <meshBasicMaterial
                      color="#FFFFFF"
                      transparent
                      opacity={0.8}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                    />
                  </mesh>
                  <mesh position={[0, 0, sz * -0.045]}>
                    <boxGeometry args={[0.008, 0.004, 0.09]} />
                    <meshBasicMaterial
                      color="#FFFFFF"
                      transparent
                      opacity={0.8}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              ))
            )}
          </group>

          {/* Ground Projection Telemetry Ring. This ring carries the whole
              coverage read: it sweeps outward as a swath is flown, so coverage
              progress is shown without a flat quad floating on the ground. */}
          <mesh ref={coverageRingRef} position={[0, -1.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.5, 20]} />
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Altimeter Ground Wash — soft additive pool that grounds the airframe */}
          <mesh position={[0, -1.619, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.78, 24]} />
            <primitive object={groundWashMaterial} attach="material" />
          </mesh>

          {/* LiDAR scan pool: the circular footprint of the ranging beam */}
          <mesh ref={scanPoolRef} position={[0, -1.617, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.3, 20]} />
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.28}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Planned exposure stations: a ring per shot, brighter once taken */}
          <group position={[0, -1.616, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            {photoStations.map((station, i) => (
              <mesh
                key={`station-${i}`}
                ref={(el) => {
                  photoStationRefs.current[i] = el as THREE.Mesh;
                }}
                position={[
                  0,
                  -surveyPlan.swathLength / 2 + station.phase * surveyPlan.swathLength,
                  0,
                ]}
              >
                <ringGeometry args={[0.03, 0.042, 12]} />
                <meshBasicMaterial
                  color="#38BDF8"
                  transparent
                  opacity={0.45}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      {/* =========================================================================
          SPATIAL FLIGHT TELEMETRY HUD OVERLAYS (COMMAND CENTER PROTOCOL)
      ========================================================================= */}
      <group ref={hudRingRef} position={[0, -0.1, 0]}>
        {/* Orbital Azimuth Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.2, 0.008, 6, 32]} />
          <meshBasicMaterial
            color={themeColor}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Dense azimuth tick graduation */}
        {Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2).map(
          (angle, i) => (
            <mesh
              key={`tick-${i}`}
              position={[2.2 * Math.cos(angle), 0, 2.2 * Math.sin(angle)]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[i % 6 === 0 ? 0.14 : 0.07, 0.012, 0.012]} />
              <meshBasicMaterial color={themeColor} transparent opacity={0.8} />
            </mesh>
          )
        )}

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

        {/* Radar sweep leading edge — a bright arc segment that scans the ring */}
        <mesh ref={hudSweepRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.2, 0.02, 6, 32, Math.PI * 0.35]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

      {/* GNSS fix-quality indicator: concentric rings around the aircraft.
          A full 3D RTK fix lights all three; a degraded fix leaves the outer
          ring dark, the same convention survey controllers use. */}
      <group position={[0, 0.02, -0.55]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.004, 5, 24]} />
          <meshBasicMaterial color="#00C758" transparent opacity={0.7} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.46, 0.004, 5, 24]} />
          <meshBasicMaterial color="#00C758" transparent opacity={0.45} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.004, 5, 24]} />
          <meshBasicMaterial color="#00C758" transparent opacity={0.25} />
        </mesh>
      </group>

      {/* Return-to-home contingency: a dashed route from the aircraft back to
          the launch point, shown in the failsafe orange so it reads as a
          contingency rather than planned flight. */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[homeReturnPath, 3]}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color="#FE6E00"
          transparent
          opacity={0.4}
          dashSize={0.06}
          gapSize={0.05}
        />
      </line>

      {/* Launch / home point marker */}
      <mesh position={[0, 0.01, 1.5]}>
        <ringGeometry args={[0.07, 0.1, 4]} />
        <meshBasicMaterial
          color="#FE6E00"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      </group>
    </group>
  );
}
