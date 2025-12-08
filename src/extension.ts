// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DataDiggerConfig } from './services/datadigger/DataDiggerConfig';
import { DataDiggerProject } from './services/datadigger/DataDiggerProject';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log("[abl-datadigger] Extension actived");

  // first read OE Projects and DataDigger projects, to handle the checks
  let ddConfigs : DataDiggerConfig = await DataDiggerConfig.getInstance();

  const configListener = vscode.workspace.onDidChangeConfiguration(async e => {
    // reset DataDiggerConfig when a Setting in scope of 'abl.datadigger' is changed
    if (e.affectsConfiguration("abl.datadigger")) {
      console.log("[abl-datadigger] Configuration changed, rebuilding projectConfigs...");
      ddConfigs.clear();
      ddConfigs = await DataDiggerConfig.getInstance();
    }
  });
  context.subscriptions.push(configListener);

  const startCommand = vscode.commands.registerCommand(
    "abl-datadigger.start",
    async () => {
      await handleStartDataDigger();
    }
  );
  context.subscriptions.push(startCommand);
}

/**
 * Handle start of DataDigger
 *
 * @returns
 */
async function handleStartDataDigger(): Promise<void> {

  const ddConfigs  : DataDiggerConfig               = await DataDiggerConfig.getInstance();
  const ddProjects : Map<string, DataDiggerProject> = ddConfigs.getDataDiggerProjects();
  // console.log("[abl-datadigger] Number of DataDigger projects: " + ddProjects.size );
  // for (const [key, value] of ddProjects.entries()) {
  //   console.log(`[abl-datadigger] - ${key}: ${JSON.stringify(value)}`);
  // }

  if (ddProjects.size === 0) {
    vscode.window.showWarningMessage("ABL DataDigger: There a no DataDigger projects configured!");
    return;
  }

  // When one project, start it directly
  if (ddProjects.size === 1) {
    const [ddProjectConfig] = ddProjects.values();
    await ddConfigs.startDataDigger(ddProjectConfig);
    return;
  }

  // More projects -> show QuickPick
  const items: vscode.QuickPickItem[] = [];
  for (const [projectName, ddProjectConfig] of ddProjects.entries()) {
    items.push({
      label: projectName,
      description: ddProjectConfig.projectDir ?? ddProjectConfig.dataDiggerPath ?? ''
    });
  }

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: "Pick the OpenEdge project for ABL DataDigger"
  });

  if (!selection) {
    // user cancelled it
    return;
  }

  const chosenConfig = ddProjects.get(selection.label);
  if (!chosenConfig) {
    vscode.window.showErrorMessage(`ABL DataDigger: configuration for project '${selection.label}' is not found!`);
    return;
  }

  await ddConfigs.startDataDigger(chosenConfig);
}

// This method is called when your extension is deactivated
export function deactivate() {}
