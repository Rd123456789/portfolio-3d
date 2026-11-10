"use client";

import React from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/**
 * Studio rig for the three engineering assets.
 *
 * Almost every surface here is machined metal or carbon composite, and a
 * metal with nothing to reflect renders as flat grey. So the rig is led by a
 * small procedural studio (softboxes rendered once into a cube map, no HDR
 * download) and the direct lights only shape and accent on top of it.
 */
export default function Lighting() {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        {/* Dark studio shell so reflections fall off to a deep slate, not black */}
        <mesh scale={60}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#10151C" side={THREE.BackSide} />
        </mesh>

        {/* Overhead key softbox */}
        <Lightformer
          form="rect"
          intensity={5}
          color="#FFF4E6"
          position={[2, 9, 3]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[12, 7, 1]}
        />
        {/* Front-right fill strip, where the camera-facing chamfers catch it */}
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#FFFFFF"
          position={[8, 2.5, 7]}
          rotation={[0, -Math.PI / 3.2, 0]}
          scale={[7, 5, 1]}
        />
        {/* Cool telemetry strip from the left */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#8FD3FA"
          position={[-9, 2, 3]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[8, 3, 1]}
        />
        {/* Signal-orange kicker low and behind for a warm trailing edge */}
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#FE6E00"
          position={[3, -2.5, -9]}
          scale={[10, 2.5, 1]}
        />
        {/* Thin horizon band: gives round tubes a crisp specular line */}
        <Lightformer
          form="ring"
          intensity={1.6}
          color="#DCE6F2"
          position={[0, 0.4, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={22}
        />
      </Environment>

      <ambientLight intensity={0.32} />
      <hemisphereLight args={["#52687F", "#12161D", 0.55]} />

      {/* Key: front-right, elevated */}
      <directionalLight position={[6, 9, 8]} intensity={2.3} color="#FFF7ED" />
      {/* Cool counter-fill */}
      <directionalLight position={[-5, 4, 6]} intensity={0.8} color="#7DD3FC" />
      {/* Warm rim from low behind: catches edges without staining top faces */}
      <directionalLight position={[3, 1.2, -7]} intensity={0.9} color="#FE6E00" />
    </>
  );
}
