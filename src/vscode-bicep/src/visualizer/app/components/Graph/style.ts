// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { Stylesheet } from "cytoscape";

import moduleSvg from "../../assets/resource-explorer.svg";

function truncate(text: string, length: number) {
  return text.length > length ? text.substr(0, length - 1) + "..." : text;
}

function createDataUri(svg: string): string {
  const domParser = new DOMParser();
  const svgElement = domParser.parseFromString(svg, "text/xml").documentElement;

  return "data:image/svg+xml;utf8," + encodeURIComponent(svgElement.outerHTML);
}

export async function createResourceNodeBackgroundUri(
  symbolicName: string,
  resourceType: string | null
): Promise<string | null> {
  if (!resourceType) {
    return null;
  }

  const iconSvg = (await import("../../assets/resource.svg")).default;
  const relativeResourceType = resourceType.split("/").pop() ?? "unknown";

  const backgroundSvg = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">
      <g transform="translate(12, 16)">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
          ${iconSvg}
        </svg>
      </g>
      <text x="72" y="36" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="16" fill="#ffffff">
       ${truncate(symbolicName, 15)}
      </text>
      <text x="72" y="56" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="12" fill="#9c9c9c">
       ${truncate(relativeResourceType, 21)}
      </text>
    </svg>
    `;

  return createDataUri(backgroundSvg);
}

export function createModuleNodeBackgroundUri(
  symbolicName: string,
  modulePath: string | null
): string | null {
  if (!modulePath) {
    return null;
  }

  const backgroundSvg = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg>
    <svg xmlns="http://www.w3.org/2000/svg">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
        ${moduleSvg}
      </svg>
      <text x="30" y="14" font-family="Helvetica Neue, Helvetica, sans-serif" font-size="12" fill="#9c9c9c">
       ${truncate(symbolicName, 21)}
      </text>
    </svg>
    `;

  return createDataUri(backgroundSvg);
}

export const stylesheet: Stylesheet[] = [
  {
    selector: "node:childless",
    style: {
      shape: "round-rectangle",
      width: 220,
      height: 80,
      "background-color": "#333333",
      "background-image": "data(backgroundDataUri)",
      "border-width": 1,
      "border-color": (node) =>
        node.data("hasError") === true ? "red" : "#3f3f3f",
      "border-opacity": 0.8,
    },
  },
  {
    selector: "node:parent",
    style: {
      shape: "round-rectangle",
      "background-color": "#333333",
      "background-image": "data(backgroundDataUri)",
      "background-position-x": 12,
      "background-position-y": 8,
      "border-width": 1,
      "border-color": (node) =>
        node.data("hasError") === true ? "red" : "#9c9c9c",
      "background-blacken": 0.4,
      "background-opacity": 0.1,
      "padding-top": "40px",
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      color: "#9c9c9c",
      opacity: 0.5,
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
    },
  },
];
