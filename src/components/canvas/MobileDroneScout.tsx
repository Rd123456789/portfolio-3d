"use client";

import React from "react";
import AutonomousDroneAsset from "./AutonomousDroneAsset";
import { Project } from "@/lib/projects";

/**
 * Phone build of the survey UAV: the same airframe and diorama deck as
 * desktop, slightly smaller and with a coarser terrain mesh. Sharing one
 * implementation keeps both breakpoints in step.
 */
export default function MobileDroneScout({
  scale = 1,
  ...props
}: {
  activeProject?: Project | null;
  position?: [number, number, number];
  scale?: number;
}) {
  return <AutonomousDroneAsset {...props} scale={scale * 0.92} lite />;
}
