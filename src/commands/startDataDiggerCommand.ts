import * as vscode from "vscode";
import * as path from "path";
import { DataDiggerConfig } from "../datadigger/DataDiggerConfig";
import { DataDiggerProject } from "../datadigger/DataDiggerProject";
import { Logger } from "../util/Logger";
import { App } from "../util/App";

/**
 * Handle start of DataDigger
 *
 * @returns
 */
export async function run(): Promise<void> {

  const ddConfigs  : DataDiggerConfig               = await DataDiggerConfig.getInstance();
  const ddProjects : Map<string, DataDiggerProject> = ddConfigs.getDataDiggerProjects();
  // console.log("[abl-datadigger] Number of DataDigger projects: " + ddProjects.size );
  // for (const [key, value] of ddProjects.entries()) {
  //   console.log(`[abl-datadigger-launcher] - ${key}: ${JSON.stringify(value)}`);
  // }

  if (ddProjects.size === 0) {
    Logger.warn("ABL DataDigger Launcher: There are no DataDigger projects configured!");
    vscode.window.showWarningMessage("ABL DataDigger Launcher: There are no DataDigger projects configured!");
    return;
  }

  // When one project, start it directly
  if (ddProjects.size === 1) {
    const [ddProjectConfig] = ddProjects.values();
    await ddConfigs.startDataDigger(ddProjectConfig);
    App.ctx.globalState.update("dd.lastProject", ddProjectConfig.projectName);
    return;
  }

  // More projects -> show QuickPick (sort by lastUsed)
  const lastUsedProject =  App.ctx.globalState.get<string>("dd.lastProject");
  const items: vscode.QuickPickItem[] = [];
  for (const [projectName, ddProjectConfig] of ddProjects.entries()) {
    const desc = getQuickPickDescription(ddProjectConfig);
    items.push({
      label: projectName,
      description: desc + (projectName === lastUsedProject ? " (last used)" : "")
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
    placeHolder: "Pick the OpenEdge project for ABL DataDigger Launcher"
  });

  if (!selection) {
    // user cancelled it
    return;
  }

  const chosenConfig = ddProjects.get(selection.label);
  if (!chosenConfig) {
    Logger.error(`ABL DataDigger Launcher: configuration for project '${selection.label}' is not found!`);
    vscode.window.showErrorMessage(`ABL DataDigger Launcher: configuration for project '${selection.label}' is not found!`);
    return;
  }
   App.ctx.globalState.update("dd.lastProject", selection.label);

  await ddConfigs.startDataDigger(chosenConfig);
}

/**
 * Get description for quick pick
 *
 * @param ddProjectConfig
 * @returns Description
 */
function getQuickPickDescription(ddProjectConfig: DataDiggerProject): string {
  const defaultDDPath = App.ctx.asAbsolutePath(path.join("resources", "DataDigger"));

  if (defaultDDPath === ddProjectConfig.dataDiggerPath) {
    return "";
  }

  // Description: only with a custom DataDigger path
  if (ddProjectConfig.dataDiggerPath) {
    return path.relative(ddProjectConfig.projectDir, ddProjectConfig.dataDiggerPath);
  }

  return "";
}