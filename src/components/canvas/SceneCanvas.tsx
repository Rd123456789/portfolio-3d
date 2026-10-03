"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Experience from "./Experience";
import { Project } from "@/lib/projects";

interface SceneCanvasProps {
  onSelectProject: (project: Project) => void;
  activeProject?: Project | null;
}

export default function SceneCanvas({
  onSelectProject,
  activeProject,
}: SceneCanvasProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-auto">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45, near: 0.1, far: 100 }}
        dpr={isMobile ? [1, 1.25] : [1, 1.75]}
        performance={{ min: 0.5 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        shadows
      >
        <Suspense fallback={null}>
          <Experience
            onSelectProject={onSelectProject}
            activeProject={activeProject}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

