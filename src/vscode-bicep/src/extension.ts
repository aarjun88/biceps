// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import {
  AzureUserInput,
  createAzExtOutputChannel,
  registerUIExtensionVariables,
} from "vscode-azureextensionui";

import { launchLanguageServiceWithProgressReport } from "./language";
import { BicepVisualizerViewManager } from "./visualizer";
import {
  CommandManager,
  ShowVisualizerCommand,
  ShowVisualizerToSideCommand,
} from "./commands";
import {
  createLogger,
  resetLogger,
  activateWithTelemetryAndErrorHandling,
  Disposable,
} from "./utils";

class BicepExtension extends Disposable {
  private constructor(public readonly extensionUri: vscode.Uri) {
    super();
  }

  public static create(context: vscode.ExtensionContext) {
    const extension = new BicepExtension(context.extensionUri);
    context.subscriptions.push(extension);

    return extension;
  }
}

function registerCommands(
  extension: BicepExtension,
  languageClient: LanguageClient
) {
  const commandManager = extension.register(new CommandManager());
  const viewManager = extension.register(
    new BicepVisualizerViewManager(extension.extensionUri, languageClient)
  );

  commandManager.registerCommands(
    new ShowVisualizerCommand(viewManager),
    new ShowVisualizerToSideCommand(viewManager)
  );
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const extension = BicepExtension.create(context);

  const outputChannel = createAzExtOutputChannel("Bicep", "bicep");
  extension.register(outputChannel);
  extension.register(createLogger(context, outputChannel));

  registerUIExtensionVariables({
    context,
    outputChannel,
    ui: new AzureUserInput(context.globalState),
  });

  await activateWithTelemetryAndErrorHandling(async () => {
    const languageClient = await launchLanguageServiceWithProgressReport(
      context,
      outputChannel
    );

    registerCommands(extension, languageClient);
  });
}

export function deactivate(): void {
  resetLogger();
}
