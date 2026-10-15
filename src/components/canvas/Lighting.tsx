"use client";

import React from "react";

export default function Lighting() {
  return (
    <>
      {/* Studio Ambient Base */}
      <ambientLight intensity={0.85} />

      {/* Sky-to-Ground Hemisphere Fill for metallic & carbon-composite surfaces */}
      <hemisphereLight args={["#4A607A", "#181C24", 1.05]} />

      {/* Primary Studio Key Directional Light (Front-Right Elevated) */}
      <directionalLight position={[6, 9, 8]} intensity={2.6} color="#FFF7ED" />

      {/* Cool Telemetry Rim / Counter-Fill Directional Light */}
      <directionalLight position={[-5, 4, 6]} intensity={1.15} color="#7DD3FC" />

      {/* Back-Edge Silhouette Rim Light */}
      <directionalLight position={[2, 5, -6]} intensity={0.9} color="#FE6E00" />

      {/* Stage 1 (Hero / Globe) Warm Orbital Accent */}
      <pointLight
        position={[4, 2.0, 3]}
        color="#FFB74D"
        intensity={2.8}
        distance={16}
      />

      {/* Stage 3 (Contact / Substation) Cool Cyan Busbar Fill */}
      <pointLight
        position={[3.8, -12.5, 3]}
        color="#38BDF8"
        intensity={3.2}
        distance={14}
      />
    </>
  );
}
