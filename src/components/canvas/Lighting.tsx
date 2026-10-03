"use client";

import React from "react";

export default function Lighting() {
  return (
    <>
      {/* Soft Ambient Fill */}
      <ambientLight intensity={0.65} />

      {/* Primary Key Directional Light */}
      <directionalLight
        position={[6, 9, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Signal Orange Industrial Rim Light (Left Lateral) */}
      <pointLight
        position={[-6, 2.5, -2]}
        color="#FE6E00"
        intensity={4.2}
        distance={24}
      />

      {/* Warm Gold Satellite Glint Light */}
      <pointLight
        position={[3, 5, 2]}
        color="#FFB74D"
        intensity={1.8}
        distance={18}
      />

      {/* Cool Steel Neutral Rim Light (Right & Deep) */}
      <pointLight
        position={[6, -2, -3]}
        color="#797067"
        intensity={2.0}
        distance={20}
      />

      {/* Deep Thermal Sub-Glow */}
      <pointLight
        position={[0, -6, 2]}
        color="#A33D14"
        intensity={1.2}
        distance={16}
      />
    </>
  );
}
