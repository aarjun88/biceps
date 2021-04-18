// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { useEffect, useRef, VFC, memo } from "react";
import cytoscape from "cytoscape";
import elk from "cytoscape-elk";
import styled from "styled-components";
import { stylesheet } from "./style";

interface GraphProps {
  elements: cytoscape.ElementDefinition[];
}

const layoutOptions = {
  name: "elk",
  padding: 200,
  fit: true,
  animate: true,
  animationDuration: 800,
  animationEasing: "cubic-bezier(0.33, 1, 0.68, 1)",
  elk: {
    algorithm: "layered",
    "layered.layering.strategy": "INTERACTIVE",
    "layered.nodePlacement.bk.fixedAlignment": "BALANCED",
    "layered.cycleBreaking.strategy": "DEPTH_FIRST",
    "elk.direction": "DOWN",
    "elk.aspectRatio": 2.5,
    "spacing.nodeNodeBetweenLayers": 80,
    "spacing.baseValue": 120,
    "spacing.componentComponent": 100,
  },
};

const GraphContainer = styled.div`
  position: absolute;
  left: 0px;
  top: 0px;
  bottom: 0px;
  right: 0px;
`;

const Graph: VFC<GraphProps> = ({ elements }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cytoscapeRef = useRef<cytoscape.Core>();
  const layoutRef = useRef<cytoscape.Layouts>();

  useEffect(() => {
    if (!cytoscapeRef.current) {
      cytoscape.use(elk);
      const cy = cytoscape({
        container: containerRef.current,
        layout: layoutOptions,
        elements,
        minZoom: 0.2,
        maxZoom: 1,
        wheelSensitivity: 0.1,
        style: stylesheet,
      });

      cy.autounselectify(true);
      cy.on("layoutstop", () => {
        cy.maxZoom(2);
      });

      cytoscapeRef.current = cy;
    } else {
      layoutRef.current?.stop();
      cytoscapeRef.current.json({ elements });
      layoutRef.current = cytoscapeRef.current.layout(layoutOptions);
      layoutRef.current.run();

      console.log(elements);
    }
  }, [elements]);

  useEffect(() => () => cytoscapeRef.current?.destroy(), []);

  return <GraphContainer ref={containerRef} />;
};

export default memo(
  Graph,
  (prevProps, nextProps) =>
    prevProps.elements.length === nextProps.elements.length &&
    prevProps.elements.every((prevElement, i) => {
      const prevData = prevElement.data;
      const nextData = nextProps.elements[i].data;

      const equal =
        prevData.id === nextData.id &&
        prevData.symbolicName === nextData.symbolicName &&
        prevData.resourceType === nextData.resourceType &&
        prevData.modulePath === nextData.modulePath &&
        prevData.isCollection === nextData.isCollection &&
        prevData.hasError === nextData.hasError;

      console.log(equal);

      return equal;
    })
);
