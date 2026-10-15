"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Project } from "@/lib/projects";
import { createDiscMaterial, tickDiscMaterial } from "@/lib/shaders";

interface MobileDroneScoutProps {
  activeProject?: Project | null;
  position?: [number, number, number];
  scale?: number;
}

/**
 * 3D topographic relief wireframe grid + elevation point cloud for the
 * mobile isometric survey deck.
 */
function buildMobileTerrainGrid(
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
      Math.exp(-((nx + 0.35) ** 2 * 3.2 + (nz + 0.25) ** 2 * 2.8)) * 0.24;
    const ridge2 =
      Math.exp(-((nx - 0.4) ** 2 * 3.5 + (nz - 0.3) ** 2 * 3.0)) * 0.19;
    const wave = Math.sin(nx * 3.5) * Math.cos(nz * 3.2) * 0.035;
    return Math.max(0.01, ridge1 + ridge2 + wave + 0.025);
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

      const t = Math.min(1, y / 0.26);
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

export default function MobileDroneScout({
  activeProject,
  position = [0, 0, 0],
  scale = 1.0,
}: MobileDroneScoutProps) {
  const rootGroupRef = useRef<THREE.Group>(null!);
  const droneBodyRef = useRef<THREE.Group>(null!);
  const gimbalRef = useRef<THREE.Group>(null!);
  const laserCurtainRef = useRef<THREE.Group>(null!);
  const scanLineBarRef = useRef<THREE.Mesh>(null!);
  const targetReticleRef = useRef<THREE.Group>(null!);
  const waypointDiamondRef = useRef<THREE.Mesh>(null!);
  const compassRingRef = useRef<THREE.Group>(null!);

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

  const projectId = activeProject?.id ?? "cspdcl-gis";

  const themeColor = useMemo(() => {
    if (!activeProject) return "#FE6E00";
    if (activeProject.id === "cspdcl-gis") return "#FE6E00";
    if (activeProject.id === "track-fields") return "#38BDF8";
    if (activeProject.id === "kishan-guru") return "#10B981";
    if (activeProject.id === "solar-mapping") return "#FFB74D";
    return "#FE6E00";
  }, [activeProject]);

  const sectorTarget = useMemo((): [number, number] => {
    if (projectId === "cspdcl-gis") return [-0.46, -0.38];
    if (projectId === "solar-mapping") return [0.48, -0.38];
    if (projectId === "kishan-guru") return [-0.46, 0.42];
    if (projectId === "track-fields") return [0.46, 0.42];
    return [0, 0];
  }, [projectId]);

  const armConfigs = useMemo(
    () => [
      { x: 0.94, z: -0.88, angle: -Math.PI / 4, dir: 1, isPort: false },
      { x: -0.94, z: -0.88, angle: Math.PI / 4, dir: -1, isPort: true },
      { x: -0.94, z: 0.88, angle: (3 * Math.PI) / 4, dir: 1, isPort: true },
      { x: 0.94, z: 0.88, angle: -(3 * Math.PI) / 4, dir: -1, isPort: false },
    ],
    []
  );

  const terrainData = useMemo(
    () => buildMobileTerrainGrid(15, 15, 2.16, 1.98),
    []
  );

  const curtainGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      -0.98, -1.16, 0,
      0.98, -1.16, 0,
    ]);
    geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    return geom;
  }, []);

  const curtainRaysGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const pts: number[] = [];
    const rayCount = 7;
    for (let i = 0; i < rayCount; i++) {
      const t = i / (rayCount - 1) - 0.5;
      pts.push(0, 0, 0, t * 1.96, -1.16, 0);
    }
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3)
    );
    return geom;
  }, []);

  const miniGridLines = useMemo(() => {
    const pylons = [
      new THREE.Vector3(-0.82, 0.3, -0.62),
      new THREE.Vector3(-0.45, 0.38, -0.32),
      new THREE.Vector3(-0.08, 0.3, -0.08),
    ];
    const verts: number[] = [];
    for (let p = 0; p < pylons.length - 1; p++) {
      for (const offset of [-0.048, 0.048]) {
        const a = pylons[p].clone().add(new THREE.Vector3(0, 0, offset));
        const b = pylons[p + 1].clone().add(new THREE.Vector3(0, 0, offset));
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y -= 0.04;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const pts = curve.getPoints(8);
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
        -0.25, 0.05, -0.2, 0.25, 0.05, -0.2,
        0.25, 0.05, -0.2, 0.25, 0.05, 0.2,
        0.25, 0.05, 0.2, -0.25, 0.05, 0.2,
        -0.25, 0.05, 0.2, -0.25, 0.05, -0.2,
      ]),
    []
  );

  const rotorBlurMaterial = useMemo(
    () => createDiscMaterial({ color: themeColor, intensity: 0.88, streaks: 4 }),
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

    // 1. Isometric stage pitch + touch/pointer parallax
    if (rootGroupRef.current) {
      const targetRotX = 0.38 - state.pointer.y * 0.12;
      const targetRotY =
        -0.38 + state.pointer.x * 0.24 + Math.sin(t * 0.35) * 0.06;
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

    // 2. UAV hover & banking
    if (droneBodyRef.current) {
      droneBodyRef.current.position.y = 0.6 + Math.sin(t * 2.2) * 0.04;
      droneBodyRef.current.position.x = Math.sin(t * 0.9) * 0.05;
      droneBodyRef.current.rotation.z =
        -Math.cos(t * 0.9) * 0.04 - state.pointer.x * 0.08;
      droneBodyRef.current.rotation.x = 0.08 + Math.sin(t * 1.1) * 0.02;
    }

    // 3. Rotor blades + downwash vortex rings
    rotorRefs.forEach((ref, idx) => {
      if (ref.current) {
        ref.current.rotation.y += delta * 46 * armConfigs[idx].dir;
      }
      const ring = downwashRefs[idx].current;
      if (ring) {
        const phase = (t * 2.0 + idx * 0.25) % 1;
        ring.position.y = -0.04 - phase * 0.38;
        ring.scale.setScalar(0.65 + phase * 0.55);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - phase);
      }
    });
    tickDiscMaterial(rotorBlurMaterial, t);

    // 4. Sweeping LiDAR fan curtain + terrain scan line
    const scanSweepZ = Math.sin(t * 1.35) * 0.78;
    if (laserCurtainRef.current) {
      laserCurtainRef.current.rotation.x = Math.atan2(scanSweepZ, 1.16);
    }
    if (scanLineBarRef.current) {
      scanLineBarRef.current.position.z = scanSweepZ;
    }

    // 5. Gimbal yaw toward active project sector
    if (gimbalRef.current) {
      const targetYaw = state.pointer.x * 0.22 + sectorTarget[0] * 0.22;
      gimbalRef.current.rotation.y = THREE.MathUtils.damp(
        gimbalRef.current.rotation.y,
        targetYaw,
        5,
        delta
      );
    }

    // 6. Active project target lock reticle & floating waypoint diamond
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
      targetReticleRef.current.rotation.y = t * 0.85;
    }
    if (waypointDiamondRef.current) {
      waypointDiamondRef.current.rotation.y = -t * 1.8;
      waypointDiamondRef.current.position.y = 0.26 + Math.sin(t * 3.0) * 0.03;
    }

    // 7. Outer compass bezel ring
    if (compassRingRef.current) {
      compassRingRef.current.rotation.y = t * 0.16;
    }
  });

  return (
    <group
      ref={rootGroupRef}
      position={position}
      scale={scale}
      rotation={[0.38, -0.38, 0]}
    >
      <pointLight
        position={[0, 0.8, 1.4]}
        intensity={4.2}
        color={themeColor}
        distance={8}
      />

      {/* =====================================================================
          TIER 1: FULL SURVEY UAV AIRFRAME (MOBILE PARITY WITH DESKTOP)
      ===================================================================== */}
      <group ref={droneBodyRef} position={[0, 0.6, 0]}>
        {/* Sculpted Carbon-Composite Main Fuselage */}
        <mesh>
          <boxGeometry args={[0.64, 0.19, 1.0]} />
          <meshStandardMaterial
            color="#262F3D"
            metalness={0.55}
            roughness={0.32}
          />
        </mesh>

        {/* Chamfered Upper Avionics Canopy */}
        <mesh position={[0, 0.12, -0.02]}>
          <boxGeometry args={[0.5, 0.095, 0.78]} />
          <meshStandardMaterial
            color="#333F52"
            metalness={0.62}
            roughness={0.26}
          />
        </mesh>

        {/* Aerodynamic Nose Cone */}
        <mesh position={[0, 0.02, -0.55]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.5, 0.14, 0.2]} />
          <meshStandardMaterial
            color="#2B3545"
            metalness={0.65}
            roughness={0.28}
          />
        </mesh>

        {/* Luminous Theme Spine & Side Chines */}
        <mesh position={[0, 0.172, -0.04]}>
          <boxGeometry args={[0.15, 0.02, 0.62]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={2.2}
          />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={`m-chine-${side}`} position={[side * 0.325, 0.055, 0]}>
            <boxGeometry args={[0.015, 0.016, 0.94]} />
            <meshStandardMaterial
              color={themeColor}
              emissive={themeColor}
              emissiveIntensity={2.6}
            />
          </mesh>
        ))}

        {/* Forward Binocular Stereo-Vision Optical Sensors */}
        {[-0.15, 0.15].map((xOff, i) => (
          <group key={`m-eye-${i}`} position={[xOff, 0.025, -0.65]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.038, 0.038, 0.028, 10]} />
              <meshStandardMaterial
                color="#111827"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0, -0.016]}>
              <circleGeometry args={[0.028, 12]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
          </group>
        ))}

        {/* Dual RTK-GNSS Mushroom Antennas */}
        {[-0.17, 0.17].map((xOff, i) => (
          <group key={`m-rtk-${i}`} position={[xOff, 0.2, 0.24]}>
            <mesh>
              <cylinderGeometry args={[0.016, 0.02, 0.07, 8]} />
              <meshStandardMaterial
                color="#64748B"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.056, 0.045, 0.03, 12]} />
              <meshStandardMaterial
                color="#F8FAFC"
                metalness={0.3}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.054, 0.005, 6, 16]} />
              <meshBasicMaterial color={themeColor} />
            </mesh>
          </group>
        ))}

        {/* Dorsal Strobe Dome */}
        <mesh position={[0, 0.195, -0.25]}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={themeColor}
            emissiveIntensity={5}
          />
        </mesh>

        {/* Rear Smart LiPo Battery Bay with 4 Charge Bars */}
        <group position={[0, 0.01, 0.51]}>
          <mesh>
            <boxGeometry args={[0.4, 0.13, 0.07]} />
            <meshStandardMaterial color="#181F29" metalness={0.8} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3].map((b) => (
            <mesh key={`m-bat-${b}`} position={[-0.105 + b * 0.07, 0, 0.038]}>
              <boxGeometry args={[0.048, 0.02, 0.008]} />
              <meshBasicMaterial color="#10B981" />
            </mesh>
          ))}
        </group>

        {/* Wide-Stance Carbon Landing Skids */}
        {[-1, 1].map((side) => (
          <group key={`m-skid-${side}`} position={[side * 0.4, -0.29, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 1.06, 8]} />
              <meshStandardMaterial
                color="#1E2530"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            {[-0.53, 0.53].map((zEnd, zi) => (
              <mesh key={zi} position={[0, 0, zEnd]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.023, 0.023, 0.06, 8]} />
                <meshBasicMaterial color={themeColor} />
              </mesh>
            ))}
            {[-0.25, 0.25].map((zStrut, si) => (
              <mesh
                key={si}
                position={[-side * 0.055, 0.145, zStrut]}
                rotation={[0, 0, side * 0.26]}
              >
                <cylinderGeometry args={[0.014, 0.016, 0.32, 8]} />
                <meshStandardMaterial
                  color="#334155"
                  metalness={0.82}
                  roughness={0.28}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* 4 Swept Carbon Booms, Brushless Motors, Blades & Blur Discs */}
        {armConfigs.map((arm, i) => (
          <group key={`m-arm-${i}`}>
            <mesh
              position={[arm.x * 0.52, 0.035, arm.z * 0.52]}
              rotation={[0, arm.angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.028, 0.034, 1.08, 10]} />
              <meshStandardMaterial
                color="#262E3B"
                metalness={0.68}
                roughness={0.32}
              />
            </mesh>
            <mesh
              position={[arm.x * 0.52, 0.074, arm.z * 0.52]}
              rotation={[0, arm.angle, Math.PI / 2]}
            >
              <boxGeometry args={[0.015, 1.02, 0.015]} />
              <meshStandardMaterial
                color={themeColor}
                emissive={themeColor}
                emissiveIntensity={2.5}
              />
            </mesh>

            <group position={[arm.x, 0.07, arm.z]}>
              <mesh position={[0, -0.035, 0]}>
                <cylinderGeometry args={[0.095, 0.082, 0.055, 12]} />
                <meshStandardMaterial
                  color="#1E2530"
                  metalness={0.85}
                  roughness={0.25}
                />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.084, 0.088, 0.09, 12]} />
                <meshStandardMaterial
                  color={themeColor}
                  emissive={themeColor}
                  emissiveIntensity={0.65}
                  metalness={0.88}
                  roughness={0.2}
                />
              </mesh>

              {/* Port/Starboard Nav Strobe */}
              <mesh position={[arm.x > 0 ? 0.082 : -0.082, -0.035, 0]}>
                <sphereGeometry args={[0.024, 8, 8]} />
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
                <ringGeometry args={[0.32, 0.36, 20]} />
                <meshBasicMaterial
                  color={themeColor}
                  transparent
                  opacity={0.22}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              {/* Spinning Propeller Hub, Blades & Blur Disc */}
              <group ref={rotorRefs[i]} position={[0, 0.085, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.028, 0.038, 0.05, 10]} />
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
                    <mesh position={[bladeDir * 0.35, 0, 0]}>
                      <boxGeometry args={[0.68, 0.01, 0.076]} />
                      <meshStandardMaterial
                        color="#1E293B"
                        metalness={0.7}
                        roughness={0.25}
                        transparent
                        opacity={0.55}
                      />
                    </mesh>
                    <mesh position={[bladeDir * 0.63, 0.006, 0]}>
                      <boxGeometry args={[0.11, 0.006, 0.078]} />
                      <meshBasicMaterial color={themeColor} />
                    </mesh>
                  </group>
                ))}

                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.72, 28]} />
                  <primitive object={rotorBlurMaterial} attach="material" />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.7, 0.725, 28]} />
                  <meshBasicMaterial
                    color={themeColor}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.48}
                  />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        {/* Underslung 3-Axis Optical & LiDAR Gimbal Turret */}
        <group ref={gimbalRef} position={[0, -0.13, -0.2]}>
          <mesh>
            <cylinderGeometry args={[0.075, 0.075, 0.045, 10]} />
            <meshStandardMaterial color="#334155" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh position={[0, -0.065, 0]}>
            <boxGeometry args={[0.19, 0.09, 0.05]} />
            <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.13, 0]}>
            <sphereGeometry args={[0.105, 14, 14]} />
            <meshStandardMaterial color="#263040" metalness={0.82} roughness={0.22} />
          </mesh>
          <mesh position={[0.032, -0.13, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.045, 10]} />
            <meshStandardMaterial color="#FE6E00" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.032, -0.13, -0.116]}>
            <circleGeometry args={[0.028, 12]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>
        </group>

        {/* Sweeping Volumetric LiDAR Laser Curtain + Discrete Rays */}
        <group ref={laserCurtainRef} position={[0, -0.34, -0.2]}>
          <mesh geometry={curtainGeometry}>
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={curtainRaysGeometry}>
            <lineBasicMaterial
              color={themeColor}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineSegments>
        </group>
      </group>

      {/* =====================================================================
          TIER 2: 3D ISOMETRIC TOPOGRAPHIC TERRAIN & 4 PROJECT SECTORS
      ===================================================================== */}
      <group position={[0, -0.88, 0]}>
        {/* Machined Obsidian Plinth Slab */}
        <mesh position={[0, -0.07, 0]}>
          <boxGeometry args={[2.32, 0.13, 2.12]} />
          <meshStandardMaterial
            color="#11161F"
            metalness={0.75}
            roughness={0.35}
          />
        </mesh>

        {/* Upper Survey Surface */}
        <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.2, 2.02]} />
          <meshStandardMaterial color="#0B1018" metalness={0.5} roughness={0.6} />
        </mesh>

        {/* Luminous Perimeter Curbing */}
        <mesh position={[0, 0.002, -1.02]}>
          <boxGeometry args={[2.24, 0.014, 0.018]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>
        <mesh position={[0, 0.002, 1.02]}>
          <boxGeometry args={[2.24, 0.014, 0.018]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>
        <mesh position={[-1.12, 0.002, 0]}>
          <boxGeometry args={[0.018, 0.014, 2.04]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.75} />
        </mesh>
        <mesh position={[1.12, 0.002, 0]}>
          <boxGeometry args={[0.018, 0.014, 2.04]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.75} />
        </mesh>

        {/* 4 Corner Benchmark Pillars */}
        {[
          [-1.12, -1.02],
          [1.12, -1.02],
          [-1.12, 1.02],
          [1.12, 1.02],
        ].map(([cx, cz], idx) => (
          <group key={`m-fid-${idx}`} position={[cx, 0.02, cz]}>
            <mesh>
              <boxGeometry args={[0.08, 0.045, 0.08]} />
              <meshStandardMaterial color="#273244" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.026, 0]}>
              <boxGeometry args={[0.045, 0.01, 0.045]} />
              <meshBasicMaterial color={themeColor} />
            </mesh>
          </group>
        ))}

        {/* 3D Topographic Wireframe + Elevation Point Cloud */}
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
            opacity={0.36}
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
            size={0.036}
            vertexColors
            transparent
            opacity={0.92}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        {/* SECTOR A (NW): CSPDCL Electrical Distribution Corridor */}
        <group>
          {[
            [-0.82, -0.62, 0.14],
            [-0.45, -0.32, 0.22],
            [-0.08, -0.08, 0.14],
          ].map(([px, pz, baseH], idx) => (
            <group key={`m-pylon-${idx}`} position={[px, baseH, pz]}>
              <mesh position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.012, 0.03, 0.2, 4]} />
                <meshStandardMaterial
                  color={projectId === "cspdcl-gis" ? "#FE6E00" : "#94A3B8"}
                  emissive={projectId === "cspdcl-gis" ? "#FE6E00" : "#000000"}
                  emissiveIntensity={projectId === "cspdcl-gis" ? 1.5 : 0}
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[0.11, 0.01, 0.012]} />
                <meshBasicMaterial
                  color={projectId === "cspdcl-gis" ? "#FFB74D" : "#CBD5E1"}
                />
              </mesh>
              <mesh position={[0, 0.19, 0]}>
                <sphereGeometry args={[0.015, 8, 8]} />
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

        {/* SECTOR B (NE): Rooftop Solar CAD Array */}
        <group position={[0.48, 0.11, -0.38]}>
          <mesh position={[0, -0.035, 0]}>
            <boxGeometry args={[0.64, 0.09, 0.5]} />
            <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
          </mesh>
          {[-0.19, 0, 0.19].map((rx, rIdx) =>
            [-0.14, -0.045, 0.05, 0.145].map((cz, cIdx) => (
              <mesh
                key={`m-solar-${rIdx}-${cIdx}`}
                position={[rx, 0.028, cz]}
                rotation={[-0.28, 0, 0]}
              >
                <boxGeometry args={[0.15, 0.008, 0.075]} />
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
        <group position={[-0.46, 0.05, 0.42]}>
          {[-0.19, -0.06, 0.07, 0.2].map((zRow, rIdx) => (
            <mesh key={`m-crop-${rIdx}`} position={[0, 0.015, zRow]}>
              <boxGeometry args={[0.64, 0.022, 0.085]} />
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

        {/* SECTOR D (SE): Track-Fields GPS Boundary Polygon & Beacons */}
        <group position={[0.46, 0.05, 0.42]}>
          {[
            [-0.25, -0.2],
            [0.25, -0.2],
            [0.25, 0.2],
            [-0.25, 0.2],
          ].map(([bx, bz], bIdx) => (
            <group key={`m-gps-${bIdx}`} position={[bx, 0.04, bz]}>
              <mesh>
                <cylinderGeometry args={[0.01, 0.01, 0.11, 6]} />
                <meshBasicMaterial color="#38BDF8" />
              </mesh>
              <mesh position={[0, 0.065, 0]}>
                <octahedronGeometry args={[0.022, 0]} />
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

        {/* Sweeping LiDAR Scan-Line Bar on the Terrain */}
        <mesh
          ref={scanLineBarRef}
          position={[0, 0.13, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2.1, 0.05]} />
          <meshBasicMaterial
            color={themeColor}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Active Project Target Lock Reticle + Floating Waypoint Diamond */}
        <group ref={targetReticleRef} position={[-0.46, 0.16, -0.38]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 0.235, 6]} />
            <meshBasicMaterial
              color={themeColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.055, 0.08, 16]} />
            <meshBasicMaterial color="#FFFFFF" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.004, 0.012, 0.24, 6]} />
            <meshBasicMaterial
              color={themeColor}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={waypointDiamondRef} position={[0, 0.26, 0]}>
            <octahedronGeometry args={[0.042, 0]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          TIER 3: GRADUATED ORBITAL COMPASS RING
      ===================================================================== */}
      <group ref={compassRingRef} position={[0, -0.14, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.76, 0.0055, 6, 56]} />
          <meshBasicMaterial color={themeColor} transparent opacity={0.4} />
        </mesh>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const isCard = i % 4 === 0;
          return (
            <mesh
              key={`m-orb-tick-${i}`}
              position={[Math.cos(a) * 1.76, 0, Math.sin(a) * 1.76]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry
                args={[isCard ? 0.11 : 0.05, 0.01, isCard ? 0.014 : 0.007]}
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
