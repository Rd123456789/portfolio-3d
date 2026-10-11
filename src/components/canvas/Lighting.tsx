"use client";

import React from "react";

export default function Lighting() {
  return (
    <>
      {/* Soft Ambient Fill */}
      <ambientLight intensity={0.8} />

      {/* Primary Key Directional Light (no shadow pass: nothing receives it) */}
      <directionalLight position={[6, 9, 6]} intensity={2.4} />

      {/* Signal Orange Industrial Rim Light (Left Lateral) */}
      <pointLight
        position={[-6, 2.5, -2]}
        color="#FE6E00"
        intensity={4.5}
        distance={24}
      />

      {/* Warm Gold Satellite Glint Light */}
      <pointLight
        position={[3, 5, 2]}
        color="#FFB74D"
        intensity={2.2}
        distance={18}
      />
    </>
  );
}
