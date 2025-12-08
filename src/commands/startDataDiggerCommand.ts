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
    context.globalState.update("dd.lastProject", ddProjectConfig.projectName);
    return;
  }

  // More projects -> show QuickPick (sort by lastUsed)
  const lastUsedProject = context.globalState.get<string>("dd.lastProject");
  const items: vscode.QuickPickItem[] = [];
  for (const [projectName, ddProjectConfig] of ddProjects.entries()) {
    items.push({
      label: projectName,
      description: ddProjectConfig.projectDir + (projectName === lastUsedProject ? " (last used)" : "")
    });
  }

  // Sort: last used project first
  if (lastUsedProject) {
    items.sort((a, b) => {
        if (a.label === lastUsedProject) return -1;
        if (b.label === lastUsedProject) return 1;
        return a.label.localeCompare(b.label); // alphabetic for the rest
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
  context.globalState.update("dd.lastProject", selection.label);

  await ddConfigs.startDataDigger(chosenConfig);
}
