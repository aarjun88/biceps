// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// import cytoscape from "cytoscape";
import { useEffect, useState, VFC } from "react";
import { ElementDefinition } from "cytoscape";

import Graph from "./Graph/Graph";
import type { BicepVisualizerViewState } from "../../types";
import {
  createModuleNodeBackgroundUri,
  createResourceNodeBackgroundUri,
} from "./Graph/style";

interface VSCode {
  postMessage(message: unknown): void;
  setState(state: unknown): void;
  getState<T>(): T;
}

declare const vscode: VSCode;

async function createGraphElements(
  state: BicepVisualizerViewState | null | undefined
): Promise<ElementDefinition[]> {
  if (!state) {
    return [];
  }

  const nodes = await Promise.all(
    state.deploymentGraph.nodes.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async ({ range, parentId, ...data }) => ({
        data: {
          ...data,
          parent: parentId ? parentId : undefined,
          backgroundDataUri:
            (await createResourceNodeBackgroundUri(
              data.symbolicName,
              data.resourceType
            )) ??
            createModuleNodeBackgroundUri(data.symbolicName, data.modulePath) ??
            undefined,
        },
      })
    )
  );

  const edges = state.deploymentGraph.edges.map(({ sourceId, targetId }) => ({
    data: {
      id: `${sourceId}>${targetId}`,
      source: sourceId,
      target: targetId,
    },
  }));

  return [...nodes, ...edges];
}

export const App: VFC = () => {
  const [elements, setElements] = useState<ElementDefinition[]>([]);

  const handleMessageEvent = (
    e: MessageEvent<BicepVisualizerViewState | undefined>
  ) => {
    const state = e.data;
    vscode.setState(state);
    createGraphElements(state).then((elements) => setElements(elements));
  };

  useEffect(() => {
    window.addEventListener("message", handleMessageEvent);

    const state = vscode.getState<BicepVisualizerViewState | undefined>();

    if (state) {
      createGraphElements(state).then((elements) => {
        setElements(elements);
        vscode.postMessage("refresh");
      });
    } else {
      vscode.postMessage("refresh");
    }

    return () => window.removeEventListener("message", handleMessageEvent);
  }, []);

  return <Graph elements={elements} />;
};
