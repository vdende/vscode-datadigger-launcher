import * as vscode from "vscode";
import * as startDataDigger from "./commands/startDataDiggerCommand";
import { DataDiggerConfig } from "./datadigger/DataDiggerConfig";
import { Logger } from "./util/Logger";
import { App } from "./util/App";

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  // first set the context to use globally
  App.init(context);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  Logger.info("Starting ABL DataDigger extension ...");

  // first read OE Projects and DataDigger projects, to handle the checks
  let ddConfigs : DataDiggerConfig = await DataDiggerConfig.getInstance();

  const configListener = vscode.workspace.onDidChangeConfiguration(async e => {
    // reset DataDiggerConfig when all settings in scope of 'abl.datadigger.*' are changed
    if (e.affectsConfiguration("abl.datadigger")) {
      Logger.info("Settings changed - reloading project configurations ...");
      ddConfigs.clear();
      ddConfigs = await DataDiggerConfig.getInstance();
    }
    if (e.affectsConfiguration("abl.datadigger.debugLogging")) {
      Logger.info("Settings changed - reload debug logging level");
      Logger.reloadConfiguration();
    }
  });
  App.ctx.subscriptions.push(configListener);

  // register start command
  const startCommand = vscode.commands.registerCommand("abl-datadigger.start", async () => {
    await startDataDigger.run();
  });
   App.ctx.subscriptions.push(startCommand);

  Logger.info("ABL DataDigger extension started");
}

// This method is called when your extension is deactivated
export function deactivate() {}
