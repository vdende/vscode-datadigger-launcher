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
  await vscode.commands.executeCommand("setContext", "datadiggerReady", false);
  await vscode.commands.executeCommand("setContext", "hasDefaultProject", false);

  // Check platform
  if (process.platform !== "win32") {
    void vscode.window.showErrorMessage(`ABL DataDigger Launcher is for Windows only and cannot run on '${process.platform}'. Please uninstall this extension`);
    return;
  }

  // first set the context to use globally
  App.init(context);

  // load logger
  Logger.reloadConfiguration();

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  Logger.info("Starting ABL DataDigger Launcher extension ...");

  // first read OE Projects and DataDigger projects, to handle the checks
  let ddConfigs: DataDiggerConfig = await DataDiggerConfig.getInstance();

  const configListener = vscode.workspace.onDidChangeConfiguration(async e => {
    // reset DataDiggerConfig when all settings in scope of 'abl.datadigger.*' are changed
    if (e.affectsConfiguration("abl.datadiggerLauncher")) {
      Logger.info("Settings changed - reloading project configurations ...");
      ddConfigs.clear();
      ddConfigs = await DataDiggerConfig.getInstance();
    }
    if (e.affectsConfiguration("abl.datadiggerLauncher.debugLogging")) {
      Logger.info("Settings changed - reload debug logging level");
      Logger.reloadConfiguration();
    }
    if (e.affectsConfiguration("abl.defaultProject")) {
      const defaultProject: string | undefined = vscode.workspace.getConfiguration("abl").get("defaultProject");
      await vscode.commands.executeCommand("setContext", "hasDefaultProject", !!(defaultProject));
    }
  });
  App.ctx.subscriptions.push(configListener);

  // register launch commandos
  App.ctx.subscriptions.push(vscode.commands.registerCommand("abl-datadigger.launch", async () => {
    await startDataDigger.run();
  }));
  App.ctx.subscriptions.push(vscode.commands.registerCommand("abl-datadigger.launchForProject", async (fileUri: vscode.Uri) => {
    await startDataDigger.run(fileUri);
  }));
  App.ctx.subscriptions.push(vscode.commands.registerCommand("abl-datadigger.launchForDefaultProject", async () => {
    await startDataDigger.run("default");
  }));

  const numProjects: number = ddConfigs.getNumberOfProjects();
  await vscode.commands.executeCommand("setContext", "datadiggerReady", numProjects > 0);

  // Set hasDefaultProject when there's a default project configured and more than 1 project
  const defaultProject: string | undefined = vscode.workspace.getConfiguration("abl").get("defaultProject");
  await vscode.commands.executeCommand("setContext", "hasDefaultProject", !!(defaultProject));

  if (numProjects === 0) {
    Logger.warn("ABL DataDigger Launcher extension started, but no OpenEdge projects found to launch DataDigger for");
  } else {
    Logger.info(`ABL DataDigger Launcher extension started (${numProjects} projects)`);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
