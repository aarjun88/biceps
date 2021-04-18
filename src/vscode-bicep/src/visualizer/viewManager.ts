// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

import { BicepVisualizerView } from "./view";
import { Disposable } from "../utils";
import { BicepVisualizerViewState } from "./types";

export class BicepVisualizerViewManager
  extends Disposable
  implements vscode.WebviewPanelSerializer {
  private readonly views = new Set<BicepVisualizerView>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly languageClient: LanguageClient
  ) {
    super();

    this.register(
      vscode.window.registerWebviewPanelSerializer(
        BicepVisualizerView.viewType,
        this
      )
    );
  }

  public openView(
    documentUri: vscode.Uri,
    viewColumn: vscode.ViewColumn
  ): void {
    let view = this.findView(documentUri);

    if (view) {
      view.reveal();
      return;
    }

    view = this.registerView(
      BicepVisualizerView.create(
        this.languageClient,
        viewColumn,
        this.extensionUri,
        documentUri
      )
    );
  }

  public async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state: BicepVisualizerViewState
  ): Promise<void> {
    console.log(state);

    this.registerView(
      BicepVisualizerView.revive(
        this.languageClient,
        webviewPanel,
        this.extensionUri,
        state
      )
    );
  }

  public dispose(): void {
    super.dispose();

    for (const view of this.views) {
      view.dispose();
    }

    this.views.clear();
  }

  private findView(documentUri: vscode.Uri): BicepVisualizerView | undefined {
    for (const view of this.views) {
      if (view.isViewOf(documentUri)) {
        return view;
      }
    }

    return undefined;
  }

  private registerView(view: BicepVisualizerView): BicepVisualizerView {
    this.views.add(view);
    view.onDidDispose(() => this.views.delete(view));

    return view;
  }
}
