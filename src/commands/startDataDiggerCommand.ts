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
export async function run(uri?: vscode.Uri): Promise<void> {

  const ddConfigs  : DataDiggerConfig               = await DataDiggerConfig.getInstance();
  const ddProjects : Map<string, DataDiggerProject> = ddConfigs.getDataDiggerProjects();
  // console.log("[abl-datadigger] Number of DataDigger projects: " + ddProjects.size );
  // for (const [key, value] of ddProjects.entries()) {
  //   console.log(`[abl-datadigger-launcher] - ${key}: ${JSON.stringify(value)}`);
  // }

  if (ddProjects.size === 0) {
    Logger.warn("ABL DataDigger Launcher: There is no DataDigger project configured");
    vscode.window.showWarningMessage("ABL DataDigger Launcher: There is no DataDigger project configured");
    return;
  }

  // When one project, start it directly
  if (ddProjects.size === 1) {
    const [ddProjectConfig] = ddProjects.values();
    await ddConfigs.startDataDigger(ddProjectConfig);
    App.ctx.globalState.update("dd.lastProject", ddProjectConfig.projectKey);
    return;
  }

  // When uri is given (selected from explorer), try to find the matching project directly
  if (uri) {
    const fsPath = uri.fsPath;
    // only when fsPath is a valid uri, we try to launch directly and if not found give a warning
    // but when the user clicked in the explorer menu and no file was selected, the quick-pick will be shown
    if (fsPath) {
      for (const ddProjectConfig of ddProjects.values()) {
        if (fsPath.startsWith(ddProjectConfig.projectDir)) {
          await ddConfigs.startDataDigger(ddProjectConfig);
          App.ctx.globalState.update("dd.lastProject", ddProjectConfig.projectKey);
          return;
        }
      }
      Logger.warn(`ABL DataDigger Launcher: No matching DataDigger project found for path '${fsPath}'`);
      vscode.window.showWarningMessage(`Cannot launch ABL DataDigger, because selected resource is not part of an OpenEdge project or does not have any database connections`);
      return;
    }
  }

  // More projects -> show QuickPick (sort by lastUsed)
  const lastUsedProject = App.ctx.globalState.get<string>("dd.lastProject");
  const items: Array<vscode.QuickPickItem & { projectKey: string }> = [];
  for (const [projectKey, ddProjectConfig] of ddProjects.entries()) {
    const desc = getQuickPickDescription(ddProjectConfig);
    items.push({
      label: ddProjectConfig.projectName,
      description: desc + (projectKey === lastUsedProject ? " (last used)" : ""),
      projectKey: projectKey
    });
  }

  // Sort: last used project first
  if (lastUsedProject) {
    items.sort((a, b) => {
        if (a.projectKey === lastUsedProject) { return -1; }
        if (b.projectKey === lastUsedProject) { return 1; }
        return a.label.localeCompare(b.label); // alphabetic for the rest
    });
  }

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: "Pick the OpenEdge ABL project for ABL DataDigger Launcher"
  });

  if (!selection) {
    // user cancelled it
    return;
  }

  const chosenConfig = ddProjects.get(selection.projectKey);
  if (!chosenConfig) {
    Logger.error(`ABL DataDigger Launcher: configuration for project '${selection.label}' is not found!`);
    vscode.window.showErrorMessage(`ABL DataDigger Launcher: configuration for project '${selection.label}' is not found!`);
    return;
  }
   App.ctx.globalState.update("dd.lastProject", selection.projectKey);

  await ddConfigs.startDataDigger(chosenConfig);
}

/**
 * Get description for quick pick
 *
 * @param ddProjectConfig
 * @returns Description
 */
function getQuickPickDescription(ddProjectConfig: DataDiggerProject): string {
  const defaultDDPath = App.BundledDataDiggerPath();

  if (defaultDDPath === ddProjectConfig.dataDiggerPath) {
    return "";
  }

  // Description: only with a custom DataDigger path
  if (ddProjectConfig.dataDiggerPath) {
    return path.relative(ddProjectConfig.projectDir, ddProjectConfig.dataDiggerPath);
  }

  return "";
}