// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import type { DeploymentGraph } from "../language/protocol";

export interface BicepVisualizerViewState {
  documentUri: string;
  deploymentGraph: DeploymentGraph;
}
