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

/**
 * Builds a 3D topographic relief wireframe grid + elevation point cloud for the
 * isometric survey deck beneath the UAV.
 */
function buildTerrainGrid(
  cols: number,
  rows: number,
  width: number,
  depth: number
): {
  linePositions: Float32Array;
  pointPositions: Float32Array;
  pointColors: Float32Array;
} {
  const heightAt = (nx: number, nz: number) => {
    const ridge1 =
      Math.exp(-((nx + 0.35) ** 2 * 3.2 + (nz + 0.25) ** 2 * 2.8)) * 0.26;
    const ridge2 =
      Math.exp(-((nx - 0.4) ** 2 * 3.5 + (nz - 0.3) ** 2 * 3.0)) * 0.2;
    const wave = Math.sin(nx * 3.5) * Math.cos(nz * 3.2) * 0.04;
    return Math.max(0.01, ridge1 + ridge2 + wave + 0.03);
  };

  const lineVerts: number[] = [];
  const ptVerts: number[] = [];
  const ptCols: number[] = [];

  const lowCol = new THREE.Color("#1E3A5F");
  const midCol = new THREE.Color("#38BDF8");
  const highCol = new THREE.Color("#FE6E00");
  const tmpCol = new THREE.Color();

  const getPos = (c: number, r: number): [number, number, number] => {
    const u = c / (cols - 1) - 0.5;
    const v = r / (rows - 1) - 0.5;
    const x = u * width;
    const z = v * depth;
    const y = heightAt(u * 2, v * 2);
    return [x, y, z];
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [x, y, z] = getPos(c, r);
      ptVerts.push(x, y + 0.006, z);

      const t = Math.min(1, y / 0.28);
      if (t < 0.5) {
        tmpCol.copy(lowCol).lerp(midCol, t * 2);
      } else {
        tmpCol.copy(midCol).lerp(highCol, (t - 0.5) * 2);
      }
      ptCols.push(tmpCol.r, tmpCol.g, tmpCol.b);

      if (c < cols - 1) {
        const [nx, ny, nz] = getPos(c + 1, r);
        lineVerts.push(x, y, z, nx, ny, nz);
      }
      if (r < rows - 1) {
        const [nx, ny, nz] = getPos(c, r + 1);
        lineVerts.push(x, y, z, nx, ny, nz);
      }
    }
  }

  return {
    linePositions: new Float32Array(lineVerts),
    pointPositions: new Float32Array(ptVerts),
    pointColors: new Float32Array(ptCols),
  };
}

export default function AutonomousDroneAsset({
  activeProject,
  position = [0, 0, 0],
  scale = 1.0,
}: AutonomousDroneAssetProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const droneBodyRef = useRef<THREE.Group>(null!);
  const gimbalRef = useRef<THREE.Group>(null!);
  const laserCurtainRef = useRef<THREE.Group>(null!);
  const scanLineBarRef = useRef<THREE.Mesh>(null!);
  const targetReticleRef = useRef<THREE.Group>(null!);
  const waypointDiamondRef = useRef<THREE.Mesh>(null!);
  const orbitalRingRef = useRef<THREE.Group>(null!);

  const rotorRefs = [
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
    useRef<THREE.Group>(null!),
  ];
  const downwashRefs = [
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
  ];

  // Match exact project IDs from src/lib/projects.ts
  const projectId = activeProject?.id ?? "cspdcl-gis";

  const themeColor = useMemo(() => {
    if (!activeProject) return "#FE6E00";
    if (activeProject.id === "cspdcl-gis") return "#FE6E00"; // Signal Orange
    if (activeProject.id === "track-fields") return "#38BDF8"; // Telemetry Cyan
    if (activeProject.id === "kishan-guru") return "#10B981"; // Agri Emerald
    if (activeProject.id === "solar-mapping") return "#FFB74D"; // Solar Gold
    return "#FE6E00";
  }, [activeProject]);

  // Target coordinates on the terrain deck for each project sector
  const sectorTarget = useMemo((): [number, number] => {
    if (projectId === "cspdcl-gis") return [-0.52, -0.42];
    if (projectId === "solar-mapping") return [0.54, -0.42];
    if (projectId === "kishan-guru") return [-0.52, 0.46];
    if (projectId === "track-fields") return [0.52, 0.46];
    return [0, 0];
  }, [projectId]);

  const armConfigs = useMemo(
    () => [
      { x: 1.02, z: -0.96, angle: -Math.PI / 4, dir: 1, isFront: true, isPort: false },
      { x: -1.02, z: -0.96, angle: Math.PI / 4, dir: -1, isFront: true, isPort: true },
      { x: -1.02, z: 0.96, angle: (3 * Math.PI) / 4, dir: 1, isFront: false, isPort: true },
      { x: 1.02, z: 0.96, angle: -(3 * Math.PI) / 4, dir: -1, isFront: false, isPort: false },
    ],
    []
  );

  const terrainData = useMemo(() => buildTerrainGrid(19, 19, 2.36, 2.16), []);

  const curtainGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      -1.08, -1.28, 0,
      1.08, -1.28, 0,
    ]);
    geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    return geom;
  }, []);

  const curtainRaysGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const pts: number[] = [];
    const rayCount = 9;
    for (let i = 0; i < rayCount; i++) {
      const t = i / (rayCount - 1) - 0.5;
      pts.push(0, 0, 0, t * 2.16, -1.28, 0);
    }
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );
    return geom;
  }, []);

  const miniGridLines = useMemo(() => {
    const pylons = [
      new THREE.Vector3(-0.92, 0.34, -0.68),
      new THREE.Vector3(-0.5, 0.42, -0.36),
      new THREE.Vector3(-0.08, 0.34, -0.1),
    ];
    const verts: number[] = [];
    for (let p = 0; p < pylons.length - 1; p++) {
      for (const offset of [-0.055, 0.055]) {
        const a = pylons[p].clone().add(new THREE.Vector3(0, 0, offset));
        const b = pylons[p + 1].clone().add(new THREE.Vector3(0, 0, offset));
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y -= 0.045;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const pts = curve.getPoints(10);
        for (let i = 0; i < pts.length - 1; i++) {
          verts.push(
            pts[i].x,
            pts[i].y,
            pts[i].z,
            pts[i + 1].x,
            pts[i + 1].y,
            pts[i + 1].z
          );
        }
      }
    }
    return new Float32Array(verts);
  }, []);

  const gpsBoundaryLines = useMemo(
    () =>
      new Float32Array([
        -0.28, 0.05, -0.22, 0.28, 0.05, -0.22,
        0.28, 0.05, -0.22, 0.28, 0.05, 0.22,
        0.28, 0.05, 0.22, -0.28, 0.05, 0.22,
        -0.28, 0.05, 0.22, -0.28, 0.05, -0.22,
      ]),
    []
  );

  const rotorBlurMaterial = useMemo(
    () => createDiscMaterial({ color: themeColor, intensity: 0.85, streaks: 4 }),
    [themeColor]
  );

  useEffect(
    () => () => {
      rotorBlurMaterial.dispose();
      curtainGeometry.dispose();
      curtainRaysGeometry.dispose();
    },
    [rotorBlurMaterial, curtainGeometry, curtainRaysGeometry]
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Isometric stage orientation + responsive cursor parallax
    if (rootGroupRef.current) {
      const targetRotX = 0.36 - state.pointer.y * 0.12;
      const targetRotY =
        -0.38 + state.pointer.x * 0.22 + Math.sin(t * 0.35) * 0.06;
      rootGroupRef.current.rotation.x = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.x,
        targetRotX,
        4,
        delta
      );
      rootGroupRef.current.rotation.y = THREE.MathUtils.damp(
        rootGroupRef.current.rotation.y,
        targetRotY,
        4,
        delta
      );
    }

    // 2. UAV precision hover & subtle flight banking
    if (droneBodyRef.current) {
      const hoverY = 0.66 + Math.sin(t * 2.1) * 0.045;
      const hoverX = Math.sin(t * 0.9) * 0.06;
      droneBodyRef.current.position.y = hoverY;
      droneBodyRef.current.position.x = hoverX;

      const bankZ = -Math.cos(t * 0.9) * 0.045 - state.pointer.x * 0.08;
      const pitchX = 0.08 + Math.sin(t * 1.1) * 0.025;
      droneBodyRef.current.rotation.z = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.z,
        bankZ,
        5,
        delta
      );
      droneBodyRef.current.rotation.x = THREE.MathUtils.damp(
        droneBodyRef.current.rotation.x,
        pitchX,
        5,
        delta
      );
    }

    // 3. High-velocity rotor rotation, downwash vortex rings & shader streaks
    rotorRefs.forEach((ref, idx) => {
      if (ref.current) {
        ref.current.rotation.y += delta * 45 * armConfigs[idx].dir;
      }
      const ring = downwashRefs[idx].current;
      if (ring) {
        const phase = (t * 2.1 + idx * 0.25) % 1;
        ring.position.y = -0.05 - phase * 0.42;
        ring.scale.setScalar(0.68 + phase * 0.6);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - phase);
      }
    });
    tickDiscMaterial(rotorBlurMaterial, t);

    // 4. Sweeping LiDAR Laser Curtain & Terrain Scan-Bar Synchronization
    const scanSweepZ = Math.sin(t * 1.35) * 0.86;
    const sweepAngleX = Math.atan2(scanSweepZ, 1.28);

    if (laserCurtainRef.current) {
      laserCurtainRef.current.rotation.x = sweepAngleX;
    }
    if (scanLineBarRef.current) {
      scanLineBarRef.current.position.z = scanSweepZ;
    }

    // 5. Gimbal tracks active project sector smoothly
    if (gimbalRef.current) {
      const targetYaw = state.pointer.x * 0.25 + sectorTarget[0] * 0.22;
      gimbalRef.current.rotation.y = THREE.MathUtils.damp(
        gimbalRef.current.rotation.y,
        targetYaw,
        5,
        delta
      );
    }

    // 6. Active Project Target Lock Reticle + Floating Waypoint Beacon
    if (targetReticleRef.current) {
      targetReticleRef.current.position.x = THREE.MathUtils.damp(
        targetReticleRef.current.position.x,
        sectorTarget[0],
        5,
        delta
      );
      targetReticleRef.current.position.z = THREE.MathUtils.damp(
        targetReticleRef.current.position.z,
        sectorTarget[1],
        5,
        delta
      );
      targetReticleRef.current.rotation.y = t * 0.8;
    }
    if (waypointDiamondRef.current) {
      waypointDiamondRef.current.rotation.y = -t * 1.8;
      waypointDiamondRef.current.position.y = 0.28 + Math.sin(t * 3.0) * 0.035;
    }

    // 7. Orbital telemetry compass bezel slow rotation
    if (orbitalRingRef.current) {
      orbitalRingRef.current.rotation.y = t * 0.16;
    }
  });

  return (
    <group
      ref={rootGroupRef}
      position={position}
      scale={scale}
      rotation={[0.36, -0.38, 0]}
    >
      {/* Dynamic project-accent key light */}
      <pointLight
        position={[0, 0.8, 1.5]}
        intensity={4.5}
        color={themeColor}
        distance={9}
      />

      {/* =====================================================================
          TIER 1: INDUSTRIAL AUTONOMOUS SURVEY UAV (HOVERING ABOVE DECK)
      ===================================================================== */}
      <group ref={droneBodyRef} position={[0, 0.66, 0]}>
        {/* 1. Sculpted Carbon-Composite Main Fuselage */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.68, 0.2, 1.08]} />
          <meshStandardMaterial
            color="#262F3D"
            metalness={0.55}
            roughness={0.32}
          />
        </mesh>

        {/* Chamfered Upper Avionics Canopy */}
        <mesh position={[0, 0.13, -0.02]}>
          <boxGeometry args={[0.52, 0.1, 0.84]} />
          <meshStandardMaterial
            color="#333F52"
            metalness={0.62}
            roughness={0.26}
          />
        </mesh>

        {/* Sculpted Aerodynamic Nose Cone */}
        <mesh position={[0, 0.02, -0.6]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.54, 0.15, 0.22]} />
          <meshStandardMaterial
            color="#2B3545"
            metalness={0.65}
            roughness={0.28}
          />
        </mesh>

        {/* Luminous Theme Spine & Side Chines */}
        <mesh position={[0, 0.185, -0.04]}>
          <boxGeometry args={[0.16, 0.022, 0.68]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={2.2}
          />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={`chine-${side}`} position={[side * 0.345, 0.06, 0]}>
            <boxGeometry args={[0.016, 0.018, 1.02]} />
            <meshStandardMaterial
              color={themeColor}
              emissive={themeColor}
              emissiveIntensity={2.8}
            />
          </mesh>
        ))}

        {/* Forward Binocular Stereo-Vision Obstacle Sensors */}
        {[-0.16, 0.16].map((xOff, i) => (
          <group key={`eye-${i}`} position={[xOff, 0.03, -0.71]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.042, 0.042, 0.03, 12]} />
              <meshStandardMaterial
                color="#111827"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0, -0.017]}>
              <circleGeometry args={[0.032, 16]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
          </group>
        ))}

        {/* Dual RTK-GNSS High-Precision Mushroom Antennas */}
        {[-0.18, 0.18].map((xOff, i) => (
          <group key={`rtk-${i}`} position={[xOff, 0.22, 0.26]}>
            <mesh>
              <cylinderGeometry args={[0.018, 0.022, 0.08, 8]} />
              <meshStandardMaterial
                color="#64748B"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 0.045, 0]}>
              <cylinderGeometry args={[0.062, 0.05, 0.032, 16]} />
              <meshStandardMaterial
                color="#F8FAFC"
                metalness={0.3}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.06, 0.005, 6, 20]} />
              <meshBasicMaterial color={themeColor} />
            </mesh>
          </group>
        ))}

        {/* Dorsal Anti-Collision Strobe Dome */}
        <mesh position={[0, 0.21, -0.28]}>
          <sphereGeometry args={[0.032, 12, 12]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={themeColor}
            emissiveIntensity={5}
          />
        </mesh>

        {/* Rear Smart LiPo Battery Bay with 4 Telemetry Charge Bars */}
        <group position={[0, 0.01, 0.55]}>
          <mesh>
            <boxGeometry args={[0.44, 0.14, 0.08]} />
            <meshStandardMaterial color="#181F29" metalness={0.8} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3].map((b) => (
            <mesh key={`bat-${b}`} position={[-0.12 + b * 0.08, 0, 0.043]}>
              <boxGeometry args={[0.055, 0.022, 0.008]} />
              <meshBasicMaterial color="#10B981" />
            </mesh>
          ))}
        </group>

        {/* 2. Wide-Stance Carbon Landing Skids */}
        {[-1, 1].map((side) => (
          <group key={`skid-${side}`} position={[side * 0.44, -0.32, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 1.16, 10]} />
              <meshStandardMaterial
                color="#1E2530"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            {[-0.58, 0.58].map((zEnd, zi) => (
              <mesh key={zi} position={[0, 0, zEnd]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.07, 10]} />
                <meshBasicMaterial color={themeColor} />
              </mesh>
            ))}
            {[-0.28, 0.28].map((zStrut, si) => (
              <mesh
                key={si}
                position={[-side * 0.06, 0.16, zStrut]}
                rotation={[0, 0, side * 0.26]}
              >
                <cylinderGeometry args={[0.016, 0.018, 0.36, 8]} />
                <meshStandardMaterial
                  color="#334155"
                  metalness={0.82}
                  roughness={0.28}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* 3. Four Swept Carbon Booms, Brushless Motors & High-Visibility Rotors */}
        {armConfigs.map((arm, i) => (
          <group key={`arm-${i}`}>
            <mesh
              position={[arm.x * 0.52, 0.04, arm.z * 0.52]}
              rotation={[0, arm.angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.032, 0.038, 1.18, 12]} />
              <meshStandardMaterial
                color="#262E3B"
                metalness={0.68}
                roughness={0.32}
              />
            </mesh>

            <mesh
              position={[arm.x * 0.52, 0.082, arm.z * 0.52]}
              rotation={[0, arm.angle, Math.PI / 2]}
            >
              <boxGeometry args={[0.016, 1.12, 0.016]} />
              <meshStandardMaterial
                color={themeColor}
                emissive={themeColor}
                emissiveIntensity={2.6}
              />
            </mesh>

            <group position={[arm.x, 0.08, arm.z]}>
              <mesh position={[0, -0.04, 0]}>
                <cylinderGeometry args={[0.105, 0.09, 0.06, 14]} />
                <meshStandardMaterial
                  color="#1E2530"
                  metalness={0.85}
                  roughness={0.25}
                />
              </mesh>
              <mesh position={[0, 0.025, 0]}>
                <cylinderGeometry args={[0.092, 0.095, 0.1, 14]} />
                <meshStandardMaterial
                  color={themeColor}
                  emissive={themeColor}
                  emissiveIntensity={0.65}
                  metalness={0.88}
                  roughness={0.2}
                />
              </mesh>

              {/* Navigation LED Beacon */}
              <mesh position={[arm.x > 0 ? 0.09 : -0.09, -0.04, 0]}>
                <sphereGeometry args={[0.026, 8, 8]} />
                <meshBasicMaterial
                  color={arm.isPort ? "#EF4444" : "#10B981"}
                />
              </mesh>

              {/* Travelling Rotor Downwash Vortex Ring */}
              <mesh
                ref={downwashRefs[i]}
                position={[0, -0.1, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <ringGeometry args={[0.35, 0.4, 24]} />
                <meshBasicMaterial
                  color={themeColor}
                  transparent
                  opacity={0.22}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              {/* Spinning Propeller Hub, Carbon Blades & Shader Blur Disc */}
              <group ref={rotorRefs[i]} position={[0, 0.095, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.03, 0.042, 0.055, 12]} />
                  <meshStandardMaterial
                    color="#E2E8F0"
                    metalness={0.92}
                    roughness={0.18}
                  />
                </mesh>

                {[-1, 1].map((bladeDir) => (
                  <group
                    key={bladeDir}
                    rotation={[0.09 * arm.dir * bladeDir, 0, 0]}
                  >
                    <mesh position={[bladeDir * 0.38, 0, 0]}>
                      <boxGeometry args={[0.74, 0.01, 0.082]} />
                      <meshStandardMaterial
                        color="#1E293B"
                        metalness={0.7}
                        roughness={0.25}
                        transparent
                        opacity={0.55}
                      />
                    </mesh>
                    <mesh position={[bladeDir * 0.69, 0.006, 0]}>
                      <boxGeometry args={[0.12, 0.006, 0.084]} />
                      <meshBasicMaterial color={themeColor} />
                    </mesh>
                  </group>
                ))}

                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.78, 32]} />
                  <primitive object={rotorBlurMaterial} attach="material" />
                </mesh>

                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.76, 0.785, 32]} />
                  <meshBasicMaterial
                    color={themeColor}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.45}
                  />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        {/* 4. Underslung 3-Axis LiDAR & Multispectral Gimbal Turret */}
        <group ref={gimbalRef} position={[0, -0.14, -0.22]}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh position={[0, -0.07, 0]}>
            <boxGeometry args={[0.21, 0.1, 0.055]} />
            <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <sphereGeometry args={[0.115, 16, 16]} />
            <meshStandardMaterial
              color="#263040"
              metalness={0.82}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0.036, -0.14, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.05, 12]} />
            <meshStandardMaterial color="#FE6E00" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.036, -0.14, -0.128]}>
            <circleGeometry args={[0.032, 16]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.032, 0.024, 0.03, 12]} />
            <meshBasicMaterial color={themeColor} />
          </mesh>
        </group>

        {/* 5. Sweeping Volumetric LiDAR Laser Curtain */}
        <group ref={laserCurtainRef} position={[0, -0.38, -0.22]}>
          <mesh geometry={curtainGeometry}>
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.18}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={curtainRaysGeometry}>
            <lineBasicMaterial
              color={themeColor}
              transparent
              opacity={0.48}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineSegments>
        </group>
      </group>

      {/* =====================================================================
          TIER 2: 3D ISOMETRIC DIGITAL-TWIN TERRAIN & PROJECT DIORAMA DECK
      ===================================================================== */}
      <group position={[0, -0.96, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[2.56, 0.14, 2.36]} />
          <meshStandardMaterial
            color="#11161F"
            metalness={0.75}
            roughness={0.35}
          />
        </mesh>

        <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.44, 2.24]} />
          <meshStandardMaterial
            color="#0B1018"
            metalness={0.5}
            roughness={0.6}
          />
        </mesh>

        {/* Luminous Perimeter Frame & Corner Benchmarks */}
        <mesh position={[0, 0.002, -1.14]}>
          <boxGeometry args={[2.48, 0.014, 0.018]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>
        <mesh position={[0, 0.002, 1.14]}>
          <boxGeometry args={[2.48, 0.014, 0.018]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>
        <mesh position={[-1.24, 0.002, 0]}>
          <boxGeometry args={[0.018, 0.014, 2.28]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.7} />
        </mesh>
        <mesh position={[1.24, 0.002, 0]}>
          <boxGeometry args={[0.018, 0.014, 2.28]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.7} />
        </mesh>

        {[
          [-1.24, -1.14],
          [1.24, -1.14],
          [-1.24, 1.14],
          [1.24, 1.14],
        ].map(([cx, cz], idx) => (
          <group key={`fid-${idx}`} position={[cx, 0.02, cz]}>
            <mesh>
              <boxGeometry args={[0.09, 0.05, 0.09]} />
              <meshStandardMaterial color="#273244" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[0.05, 0.012, 0.05]} />
              <meshBasicMaterial color={themeColor} />
            </mesh>
          </group>
        ))}

        {/* 3D Topographic Wireframe Mesh & Elevation Point Cloud */}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[terrainData.linePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#38BDF8"
            transparent
            opacity={0.34}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>

        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[terrainData.pointPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[terrainData.pointColors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.032}
            vertexColors
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        {/* SECTOR A (NW): CSPDCL Electrical Distribution Corridor */}
        <group>
          {[
            [-0.92, -0.68, 0.16],
            [-0.5, -0.36, 0.24],
            [-0.08, -0.1, 0.16],
          ].map(([px, pz, baseH], idx) => (
            <group key={`pylon-${idx}`} position={[px, baseH, pz]}>
              <mesh position={[0, 0.09, 0]}>
                <cylinderGeometry args={[0.012, 0.032, 0.22, 4]} />
                <meshStandardMaterial
                  color={projectId === "cspdcl-gis" ? "#FE6E00" : "#94A3B8"}
                  emissive={projectId === "cspdcl-gis" ? "#FE6E00" : "#000000"}
                  emissiveIntensity={projectId === "cspdcl-gis" ? 1.5 : 0}
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[0, 0.17, 0]}>
                <boxGeometry args={[0.12, 0.01, 0.012]} />
                <meshBasicMaterial
                  color={projectId === "cspdcl-gis" ? "#FFB74D" : "#CBD5E1"}
                />
              </mesh>
              <mesh position={[0, 0.21, 0]}>
                <sphereGeometry args={[0.016, 8, 8]} />
                <meshBasicMaterial color="#FE6E00" />
              </mesh>
            </group>
          ))}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[miniGridLines, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#FE6E00"
              transparent
              opacity={projectId === "cspdcl-gis" ? 0.95 : 0.45}
            />
          </lineSegments>
        </group>

        {/* SECTOR B (NE): Rooftop Solar CAD Array (France Solar Project) */}
        <group position={[0.56, 0.12, -0.44]}>
          <mesh position={[0, -0.04, 0]}>
            <boxGeometry args={[0.72, 0.1, 0.56]} />
            <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
          </mesh>
          {[-0.22, 0, 0.22].map((rx, rIdx) =>
            [-0.16, -0.05, 0.06, 0.17].map((cz, cIdx) => (
              <mesh
                key={`solar-${rIdx}-${cIdx}`}
                position={[rx, 0.03, cz]}
                rotation={[-0.28, 0, 0]}
              >
                <boxGeometry args={[0.17, 0.008, 0.085]} />
                <meshStandardMaterial
                  color="#1E3A8A"
                  emissive={
                    projectId === "solar-mapping" ? "#FFB74D" : "#38BDF8"
                  }
                  emissiveIntensity={
                    projectId === "solar-mapping" ? 1.4 : 0.35
                  }
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
            ))
          )}
        </group>

        {/* SECTOR C (SW): KishanGuru Digital Agriculture NDVI Terraces */}
        <group position={[-0.54, 0.05, 0.48]}>
          {[-0.22, -0.07, 0.08, 0.23].map((zRow, rIdx) => (
            <mesh key={`crop-${rIdx}`} position={[0, 0.015, zRow]}>
              <boxGeometry args={[0.74, 0.024, 0.095]} />
              <meshStandardMaterial
                color="#065F46"
                emissive="#10B981"
                emissiveIntensity={
                  projectId === "kishan-guru" ? 1.4 - rIdx * 0.2 : 0.35
                }
                roughness={0.4}
              />
            </mesh>
          ))}
        </group>

        {/* SECTOR D (SE): Track-Fields GPS Boundary Demarcation */}
        <group position={[0.52, 0.06, 0.48]}>
          {[
            [-0.28, -0.22],
            [0.28, -0.22],
            [0.28, 0.22],
            [-0.28, 0.22],
          ].map(([bx, bz], bIdx) => (
            <group key={`gps-${bIdx}`} position={[bx, 0.04, bz]}>
              <mesh>
                <cylinderGeometry args={[0.01, 0.01, 0.12, 6]} />
                <meshBasicMaterial color="#38BDF8" />
              </mesh>
              <mesh position={[0, 0.07, 0]}>
                <octahedronGeometry args={[0.024, 0]} />
                <meshBasicMaterial
                  color={projectId === "track-fields" ? "#FFFFFF" : "#38BDF8"}
                />
              </mesh>
            </group>
          ))}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[gpsBoundaryLines, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#38BDF8"
              transparent
              opacity={projectId === "track-fields" ? 0.95 : 0.45}
            />
          </lineSegments>
        </group>

        {/* Active LiDAR Laser Scan-Line Bar Sweeping Across the Terrain */}
        <mesh
          ref={scanLineBarRef}
          position={[0, 0.14, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2.32, 0.055]} />
          <meshBasicMaterial
            color={themeColor}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Active Project Target Lock Reticle + Floating Waypoint Beacon */}
        <group ref={targetReticleRef} position={[-0.52, 0.18, -0.42]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.255, 6]} />
            <meshBasicMaterial
              color={themeColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.085, 16]} />
            <meshBasicMaterial color="#FFFFFF" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.004, 0.014, 0.26, 6]} />
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.48}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={waypointDiamondRef} position={[0, 0.28, 0]}>
            <octahedronGeometry args={[0.046, 0]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          TIER 3: ORBITAL TELEMETRY COMPASS RING SURROUNDING THE DIORAMA
      ===================================================================== */}
      <group ref={orbitalRingRef} position={[0, -0.15, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.95, 0.006, 6, 64]} />
          <meshBasicMaterial color={themeColor} transparent opacity={0.38} />
        </mesh>
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const isCard = i % 6 === 0;
          return (
            <mesh
              key={`orb-tick-${i}`}
              position={[Math.cos(a) * 1.95, 0, Math.sin(a) * 1.95]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry
                args={[isCard ? 0.12 : 0.055, 0.01, isCard ? 0.016 : 0.008]}
              />
              <meshBasicMaterial
                color={isCard ? themeColor : "#64748B"}
                transparent
                opacity={isCard ? 0.9 : 0.5}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
