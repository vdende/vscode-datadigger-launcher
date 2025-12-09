// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as startDataDigger from "./commands/startDataDiggerCommand";
import { DataDiggerConfig } from "./datadigger/DataDiggerConfig";
import { Logger } from "./util/Logger";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  Logger.info("Starting ABL DataDigger extension ...");

  // first read OE Projects and DataDigger projects, to handle the checks
  let ddConfigs : DataDiggerConfig = await DataDiggerConfig.getInstance();

  const configListener = vscode.workspace.onDidChangeConfiguration(async e => {
    // reset DataDiggerConfig when a Setting in scope of 'abl.datadigger.path' is changed
    if (e.affectsConfiguration("abl.datadigger.path")) {
      Logger.info("Settings changed - reloading project configurations ...");
      ddConfigs.clear();
      ddConfigs = await DataDiggerConfig.getInstance();
    }
    if (e.affectsConfiguration("abl.datadigger.debugLogging")) {
      Logger.info("Settings changed - reload debug logging level");
      Logger.reloadConfiguration();
    }
  });
  context.subscriptions.push(configListener);

  // register start command
  const startCommand = vscode.commands.registerCommand("abl-datadigger.start", async () => {
    await startDataDigger.run(context);
  });
  context.subscriptions.push(startCommand);

  Logger.info("ABL DataDigger extension started");
}

// This method is called when your extension is deactivated
export function deactivate() {}
