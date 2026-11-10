"use client";

import React from "react";
import GeospatialGlobe from "./GeospatialGlobe";

/**
 * Phone build of the hero globe: the same instrument as desktop, rendered
 * with a coarser dot matrix, fewer segments and two satellites instead of
 * three. Sharing one implementation keeps both breakpoints in step.
 */
export default function GeospatialGlobeMobile(props: {
  position?: [number, number, number];
  scale?: number;
}) {
  return <GeospatialGlobe {...props} lite />;
}
