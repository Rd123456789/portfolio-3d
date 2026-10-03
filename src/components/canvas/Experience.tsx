"use client";

import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import GeospatialGlobe from "./GeospatialGlobe";
import GeospatialGlobeMobile from "./GeospatialGlobeMobile";
import AutonomousDroneAsset from "./AutonomousDroneAsset";
import MobileDroneScout from "./MobileDroneScout";
import GridNetworkAsset from "./GridNetworkAsset";
import Particles from "./Particles";
import Lighting from "./Lighting";
import { Project } from "@/lib/projects";

interface ExperienceProps {
  onSelectProject: (project: Project) => void;
  activeProject?: Project | null;
}

export default function Experience({
  onSelectProject,
  activeProject,
}: ExperienceProps) {
  const { camera } = useThree();
  const globeGroupRef = useRef<THREE.Group>(null!);
  const gridAssetRef = useRef<THREE.Group>(null!);
  const droneGroupRef = useRef<THREE.Group>(null!);
  const sceneRootRef = useRef<THREE.Group>(null!);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scrollProgressRef = useRef(0);
  const worksVisRef = useRef(0);
  const contactVisRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll =
        window.scrollY || document.documentElement.scrollTop || 0;
      scrollProgressRef.current =
        maxScroll > 0 ? Math.min(1, Math.max(0, currentScroll / maxScroll)) : 0;

      const viewH = window.innerHeight;

      // Section 03 (Works / Missions) exact viewport visibility
      const worksEl = document.getElementById("section-works");
      if (worksEl) {
        const rect = worksEl.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewH) {
          worksVisRef.current = 0;
        } else {
          // Peak visibility when section is centered
          const centerDist = Math.abs((rect.top + rect.bottom) / 2 - viewH / 2);
          const maxDist = viewH * 0.9;
          worksVisRef.current = Math.max(0, Math.min(1, 1 - centerDist / maxDist));
        }
      }

      // Section 04 (Transmission Terminal) exact viewport visibility
      const contactEl = document.getElementById("section-contact");
      if (contactEl) {
        const rect = contactEl.getBoundingClientRect();
        if (rect.top > viewH) {
          contactVisRef.current = 0;
        } else {
          contactVisRef.current = Math.min(
            1,
            Math.max(0, (viewH - rect.top) / (viewH * 0.6))
          );
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((state, delta) => {
    const p = scrollProgressRef.current; // 0.0 -> 1.0
    const worksVis = worksVisRef.current;
    const contactVis = contactVisRef.current;

    // 1. Camera Transitions
    const targetCamZ = isMobile
      ? THREE.MathUtils.lerp(5.5, 4.8, p)
      : THREE.MathUtils.lerp(5.0, 4.6, p);
    const targetCamY = isMobile
      ? THREE.MathUtils.lerp(0.2, 0.4, p)
      : THREE.MathUtils.lerp(0, 0.2, p);

    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetCamZ,
      5,
      delta
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      targetCamY,
      5,
      delta
    );

    // 2. Geospatial Globe Transitions (Strict Staging & Framing)
    if (globeGroupRef.current) {
      // Hide globe when Section 03 Missions or Section 04 Contact is active to clear the stage
      globeGroupRef.current.visible = worksVis < 0.12 && contactVis < 0.12;

      if (isMobile) {
        // MOBILE FRAMING: Positioned at y: 1.55 in Hero so it crowns the mobile viewport above text
        let targetGX = 0;
        let targetGY = 1.55;
        let targetGZ = -0.6;
        let targetGScale = 1.15;

        if (p < 0.18) {
          const t = p / 0.18;
          targetGY = THREE.MathUtils.lerp(1.55, 0.4, t);
          targetGZ = THREE.MathUtils.lerp(-0.6, -4.0, t);
          targetGScale = THREE.MathUtils.lerp(1.15, 0.9, t);
        } else {
          const t = Math.min(1, (p - 0.18) / 0.4);
          targetGY = THREE.MathUtils.lerp(0.4, -0.2, t);
          targetGZ = THREE.MathUtils.lerp(-4.0, -7.0, t);
          targetGScale = THREE.MathUtils.lerp(0.9, 0.75, t);
        }

        globeGroupRef.current.position.x = THREE.MathUtils.damp(
          globeGroupRef.current.position.x,
          targetGX,
          5,
          delta
        );
        globeGroupRef.current.position.y = THREE.MathUtils.damp(
          globeGroupRef.current.position.y,
          targetGY,
          5,
          delta
        );
        globeGroupRef.current.position.z = THREE.MathUtils.damp(
          globeGroupRef.current.position.z,
          targetGZ,
          5,
          delta
        );
        globeGroupRef.current.scale.setScalar(
          THREE.MathUtils.damp(
            globeGroupRef.current.scale.x,
            targetGScale,
            5,
            delta
          )
        );
      } else {
        // DESKTOP FRAMING: Sits cleanly inside right half in Hero (x: 1.25), moves deep behind centered dossier in Section 2
        let targetGX = 1.25;
        let targetGY = -0.05;
        let targetGZ = 0;
        let targetGScale = 1.65;

        if (p < 0.25) {
          const t = p / 0.25;
          targetGX = THREE.MathUtils.lerp(1.25, 0, t);
          targetGY = THREE.MathUtils.lerp(-0.05, 0, t);
          targetGZ = THREE.MathUtils.lerp(0, -6.0, t);
          targetGScale = THREE.MathUtils.lerp(1.65, 0.95, t);
        } else {
          const t = Math.min(1, (p - 0.25) / 0.4);
          targetGX = 0;
          targetGY = THREE.MathUtils.lerp(0, -0.2, t);
          targetGZ = THREE.MathUtils.lerp(-6.0, -8.0, t);
          targetGScale = THREE.MathUtils.lerp(0.95, 0.8, t);
        }

        globeGroupRef.current.position.x = THREE.MathUtils.damp(
          globeGroupRef.current.position.x,
          targetGX,
          5,
          delta
        );
        globeGroupRef.current.position.y = THREE.MathUtils.damp(
          globeGroupRef.current.position.y,
          targetGY,
          5,
          delta
        );
        globeGroupRef.current.position.z = THREE.MathUtils.damp(
          globeGroupRef.current.position.z,
          targetGZ,
          5,
          delta
        );
        globeGroupRef.current.scale.setScalar(
          THREE.MathUtils.damp(
            globeGroupRef.current.scale.x,
            targetGScale,
            5,
            delta
          )
        );
      }
    }

    // 3. Autonomous Drone Asset Staging (Foreground in Section 03 Missions)
    if (droneGroupRef.current) {
      droneGroupRef.current.visible = worksVis > 0.04;

      const targetDroneY = isMobile
        ? THREE.MathUtils.lerp(2.5, 0.08, worksVis)
        : THREE.MathUtils.lerp(2.5, 0.02, worksVis);
      const targetDroneX = isMobile ? 0 : 1.30;
      const targetDroneZ = isMobile
        ? THREE.MathUtils.lerp(-2.0, 0.45, worksVis)
        : THREE.MathUtils.lerp(-2.0, 0.25, worksVis);
      const targetDroneScale = isMobile
        ? THREE.MathUtils.lerp(0.2, 0.40, worksVis)
        : THREE.MathUtils.lerp(0.2, 0.58, worksVis);

      droneGroupRef.current.position.y = THREE.MathUtils.damp(
        droneGroupRef.current.position.y,
        targetDroneY,
        6,
        delta
      );
      droneGroupRef.current.position.x = THREE.MathUtils.damp(
        droneGroupRef.current.position.x,
        targetDroneX,
        6,
        delta
      );
      droneGroupRef.current.position.z = THREE.MathUtils.damp(
        droneGroupRef.current.position.z,
        targetDroneZ,
        6,
        delta
      );
      droneGroupRef.current.scale.setScalar(
        THREE.MathUtils.damp(
          droneGroupRef.current.scale.x,
          targetDroneScale,
          6,
          delta
        )
      );
    }

    // 4. Transmission Mast Staging (Visible ONLY when Section 04 Telemetry Terminal is active)
    if (gridAssetRef.current) {
      gridAssetRef.current.visible = contactVis > 0.04;

      const targetMastX = isMobile ? 0 : 2.45;
      const targetMastY = THREE.MathUtils.lerp(-10.0, isMobile ? 0.70 : -0.45, contactVis);
      const targetMastZ = THREE.MathUtils.lerp(-4.0, isMobile ? -0.75 : 0.35, contactVis);

      gridAssetRef.current.position.x = THREE.MathUtils.damp(
        gridAssetRef.current.position.x,
        targetMastX,
        5,
        delta
      );
      gridAssetRef.current.position.y = THREE.MathUtils.damp(
        gridAssetRef.current.position.y,
        targetMastY,
        5,
        delta
      );
      gridAssetRef.current.position.z = THREE.MathUtils.damp(
        gridAssetRef.current.position.z,
        targetMastZ,
        5,
        delta
      );
    }

    // 5. Parallax
    if (sceneRootRef.current) {
      const parallaxFactor = isMobile ? 0.1 : 0.28;
      const targetX = mouse.current.x * parallaxFactor;
      const targetY = mouse.current.y * (parallaxFactor * 0.7);

      sceneRootRef.current.position.x = THREE.MathUtils.damp(
        sceneRootRef.current.position.x,
        targetX,
        3,
        delta
      );
      sceneRootRef.current.position.y = THREE.MathUtils.damp(
        sceneRootRef.current.position.y,
        targetY,
        3,
        delta
      );
    }
  });

  return (
    <group ref={sceneRootRef}>
      <Lighting />
      <Particles count={isMobile ? 600 : 1200} />

      {/* 3D GEOSPATIAL GLOBE */}
      <group ref={globeGroupRef} position={[isMobile ? 0 : 1.25, 0, 0]}>
        {isMobile ? <GeospatialGlobeMobile /> : <GeospatialGlobe />}
      </group>

      {/* 3D ELECTRICAL GRID MAST */}
      <group ref={gridAssetRef} position={[2.2, -12, -4]} visible={false}>
        <GridNetworkAsset scale={isMobile ? 0.75 : 0.9} />
      </group>

      {/* 3D AUTONOMOUS DRONE (MISSION CONTROL SECTION 03) */}
      <group ref={droneGroupRef} position={[isMobile ? 0 : 1.85, 3.5, 0]} visible={false}>
        {isMobile ? (
          <MobileDroneScout activeProject={activeProject} />
        ) : (
          <AutonomousDroneAsset activeProject={activeProject} />
        )}
      </group>
    </group>
  );
}
