// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OpenEdgeAblExtensionService } from './services/oeabl/OpenEdgeAblExtensionService';
import { ProjectInfo } from './services/oeabl/ProjectInfo';
import * as fs from 'fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log("[abl-datadigger] Extension actived");

  	// Riverside dependency check - and get project infos
	const ablExt = await OpenEdgeAblExtensionService.getInstance();

	// check datadigger path for each project
	const projectInfos : Map<string, ProjectInfo> = await ablExt.getProjectInfos();
	let ddError = false;
	for (const [projectName, projectInfo] of projectInfos) {
		const projectUri : vscode.Uri = vscode.Uri.file(projectInfo.projectRoot);
		console.log("[abl-datadigger] Project '" + projectName + "' path: " + projectUri);
		const diggerPath = getDiggerPathForProject(projectUri);
		console.log(`[abl-datadigger] DataDigger path for project '${projectName}': ${diggerPath}`);
		if (!diggerPath) {
			vscode.window.showWarningMessage(
				`No valid DataDigger path found for project '${projectName}'. ` +
				`Please set the path in the settings.`
			);
			ddError = true;
		} else {
			if (!fs.existsSync(diggerPath)) {
				vscode.window.showWarningMessage(
					`The configured DataDigger path '${diggerPath}' for project '${projectName}' does not exist. ` +
					`Please check the path in the settings.`
				);
				ddError = true;
			} 
		}
	} // for
	if (ddError) {
		throw new Error("One or more DataDigger path errors detected. Please check the error messages.");
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
    // section = undefined → we gebruiken de “root” (dus key is 'abl.datadigger.path')
    // resource = projectUri → VS Code zoekt automatisch:
    //   WorkspaceFolder setting -> Workspace setting -> User setting
    vscode.workspace.getConfiguration()
	const config = vscode.workspace.getConfiguration(undefined, projectUri);
    const value = config.get<string>('abl.datadigger.path');
    return value || undefined;
}
