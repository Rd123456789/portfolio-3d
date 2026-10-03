"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import SmoothScroll from "@/components/dom/SmoothScroll";
import Navbar from "@/components/dom/Navbar";
import OverlaySections from "@/components/dom/OverlaySections";
import ProjectModal from "@/components/dom/ProjectModal";
import { Project, PROJECTS } from "@/lib/projects";

// Dynamic client import for WebGL Canvas
const SceneCanvas = dynamic(() => import("@/components/canvas/SceneCanvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-0 bg-[#1A1A1A] flex flex-col items-center justify-center gap-3">
      <div className="sq animate-pulse" />
      <div className="meta-label text-[#8A8A8A]">
        INITIALIZING 3D SPATIAL TELEMETRY MATRIX...
      </div>
    </div>
  ),
});

export default function Home() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeHoverProject, setActiveHoverProject] = useState<Project | null>(
    PROJECTS[0]
  );

  return (
    <SmoothScroll>
      <main className="relative min-h-screen bg-[#1A1A1A] text-[#D6D6D6] overflow-x-hidden">
        {/* Fixed Background 3D WebGL Canvas */}
        <SceneCanvas
          onSelectProject={setSelectedProject}
          activeProject={activeHoverProject}
        />

        {/* Subtle Industrial Grid Texture */}
        <div className="fixed inset-0 pointer-events-none z-[1] bg-grid opacity-60" />

        {/* FlytBase Thermal Sun Glow (Center Left, Muted) */}
        <div
          className="fixed top-0 right-0 w-[500px] h-[500px] pointer-events-none z-[1] opacity-20 blur-[140px]"
          style={{
            background:
              "linear-gradient(135deg, #FE5C0C 0%, #A90901 35%, #5C1A0A 55%, #1A1A1A 100%)",
          }}
        />

        {/* Top 56px Industrial HUD Navigation */}
        <Navbar />

        {/* Scrollable DOM Sections (§4.2 Max 1200px Page discipline) */}
        <OverlaySections
          onSelectProject={setSelectedProject}
          activeProject={activeHoverProject}
          onHoverProject={setActiveHoverProject}
        />

        {/* Mission Specification Modal */}
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      </main>
    </SmoothScroll>
  );
}
