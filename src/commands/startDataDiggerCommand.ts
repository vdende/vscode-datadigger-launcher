import * as vscode from "vscode";
import { DataDiggerConfig } from "../datadigger/DataDiggerConfig";
import { DataDiggerProject } from "../datadigger/DataDiggerProject";

/**
 * Handle start of DataDigger
 *
 * @returns
 */
export async function run(context: vscode.ExtensionContext): Promise<void> {

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
