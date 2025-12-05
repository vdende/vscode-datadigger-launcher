// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OpenEdgeAblExtensionService } from './services/oeabl/OpenEdgeAblExtensionService';
import { ProjectInfo } from './services/oeabl/ProjectInfo';
import { DataDiggerConfig } from './services/datadigger/DataDiggerConfig';
import { DataDiggerProject } from './services/datadigger/DataDiggerProject';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log("[abl-datadigger] Extension actived");

 	// Riverside dependency check - and get project infos
	const ablExt = await OpenEdgeAblExtensionService.getInstance();

	// check datadigger path for each project
  // TODO: waarom een await, kan dat niet zonder promise?
	const oeProjects : Map<string, ProjectInfo>       = await ablExt.getProjectInfos();
  const ddConfigs  : DataDiggerConfig               = await DataDiggerConfig.getInstance(oeProjects);
  const ddProjects : Map<string, DataDiggerProject> = ddConfigs.getDataDiggerProjects();
  console.log("[abl-datadigger] Number of DataDigger projects: " + ddProjects.size );
  for (const [key, value] of ddProjects.entries()) {
    console.log(`[abl-datadigger] - ${key}: ${JSON.stringify(value)}`);
  }

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('abl-datadigger.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from ABL DataDigger!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function getDiggerPathForProject(projectUri?: vscode.Uri): string | undefined {
  // section = undefined → we gebruiken de 'root' (dus key is 'abl.datadigger.path')
  // resource = projectUri → VS Code zoekt automatisch:
  //   WorkspaceFolder setting -> Workspace setting -> User setting
	const config = vscode.workspace.getConfiguration(undefined, projectUri);
  const value = config.get<string>('abl.datadigger.path');
  return value || undefined;
}
