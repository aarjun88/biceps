// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import vscode from "vscode";
import path from "path";
import {
  LanguageClient,
  PublishDiagnosticsNotification,
} from "vscode-languageclient/node";

import { deploymentGraphRequestType } from "../language/protocol";
import { Disposable, debounce, getLogger } from "../utils";
import { BicepVisualizerViewState } from "./types";

export class BicepVisualizerView extends Disposable {
  public static viewType = "bicep.visualizer";

  private readonly onDidDisposeEmitter: vscode.EventEmitter<void>;
  private readonly onDidChangeViewStateEmitter: vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>;

  private constructor(
    private readonly languageClient: LanguageClient,
    private readonly webviewPanel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private documentUri: vscode.Uri
  ) {
    super();

    this.onDidDisposeEmitter = new vscode.EventEmitter<void>();
    this.onDidChangeViewStateEmitter = this.register(
      new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>()
    );

    if (!this.isDisposed) {
      this.webviewPanel.webview.html = this.createWebviewHtml();
      this.register(
        this.webviewPanel.webview.onDidReceiveMessage(
          this.handleDidReceiveMessage,
          this
        )
      );
    }

    this.registerMultiple(
      this.webviewPanel.onDidDispose(this.dispose, this),
      this.webviewPanel.onDidChangeViewState((e) =>
        this.onDidChangeViewStateEmitter.fire(e)
      )
    );

    this.register(
      vscode.workspace.onDidChangeTextDocument(
        this.handleDidChangeTextDocument,
        this
      )
    );
  }

  public get onDidDispose(): vscode.Event<void> {
    return this.onDidDisposeEmitter.event;
  }

  public get onDidChangeViewState(): vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent> {
    return this.onDidChangeViewStateEmitter.event;
  }

  public static create(
    languageClient: LanguageClient,
    viewColumn: vscode.ViewColumn,
    extensionUri: vscode.Uri,
    documentUri: vscode.Uri
  ): BicepVisualizerView {
    const visualizerTitle = BicepVisualizerView.createTitle(documentUri);
    const webviewPanel = vscode.window.createWebviewPanel(
      BicepVisualizerView.viewType,
      visualizerTitle,
      viewColumn,
      { enableScripts: true }
    );

    return new BicepVisualizerView(
      languageClient,
      webviewPanel,
      extensionUri,
      documentUri
    );
  }

  public static revive(
    languageClient: LanguageClient,
    webviewPanel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    state: BicepVisualizerViewState
  ): BicepVisualizerView {
    const documentUri = vscode.Uri.parse(state.documentUri);
    return new BicepVisualizerView(
      languageClient,
      webviewPanel,
      extensionUri,
      documentUri
    );
  }

  public static createTitle(documentUri: vscode.Uri): string {
    return `Visualize ${path.basename(documentUri.fsPath)}`;
  }

  public reveal(): void {
    this.webviewPanel.reveal();
  }

  public isViewOf(documentUri: vscode.Uri): boolean {
    return this.documentUri.fsPath === documentUri.fsPath;
  }

  public dispose(): void {
    super.dispose();

    this.webviewPanel.dispose();

    // Final cleanup.
    this.onDidDisposeEmitter.fire();
    this.onDidDisposeEmitter.dispose();
  }

  private handleDidReceiveMessage(message: string): void {
    if (message === "refresh") {
      this.register(
        this.languageClient.onNotification(
          PublishDiagnosticsNotification.type,
          () => this.render()
        )
      );

      this.render();
    }
  }

  private async handleDidChangeTextDocument(
    event: vscode.TextDocumentChangeEvent
  ): Promise<void> {
    if (this.isViewOf(event.document.uri)) {
      getLogger().info("updated text");
      this.render();
    }
  }

  // Doing "fire and forget" since there's no need to wait for rendering.
  private render = debounce(() => this.doRender());
  private async doRender() {
    if (this.isDisposed) {
      return;
    }

    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(this.documentUri);
    } catch {
      this.webviewPanel.webview.html = this.createDocumentNotFoundHtml();
      return;
    }

    if (this.isDisposed) {
      return;
    }

    // TODO: notify webview.
    const deploymentGraph = await this.languageClient.sendRequest(
      deploymentGraphRequestType,
      {
        textDocument: this.languageClient.code2ProtocolConverter.asTextDocumentIdentifier(
          document
        ),
      }
    );

    this.webviewPanel.webview.postMessage({
      documentUri: this.documentUri.toString(),
      deploymentGraph,
    });
  }

  private createWebviewHtml() {
    const scriptUri = this.webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "visualizer.js")
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <!--
        Use a content security policy to only allow loading images from https or from our extension directory,
        and only allow scripts that have a specific nonce.
        -->
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cat Scratch</title>
      </head>
      <body>
        <div id="root"></div>
        <script>
          const vscode = acquireVsCodeApi();
        </script>
        <script src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private createDocumentNotFoundHtml() {
    const documentName = path.basename(this.documentUri.fsPath);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <div class="vscode-body">${documentName} not found. It might be deleted or renamed.</div>
      </body>
      </html>`;
  }
}
