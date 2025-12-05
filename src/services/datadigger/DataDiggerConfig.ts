import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from "path";
import { ProjectInfo } from '../oeabl/ProjectInfo';
import { DataDiggerProject } from './DataDiggerProject';

export class DataDiggerConfig {

  private static instance: DataDiggerConfig | undefined;

  private ddProjectConfigMap: Map<string, DataDiggerProject> = new Map();
  private initialized = false;

  /**
   * Constructor
   */
  private constructor(oeProjects: Map<string, ProjectInfo>) {
    this.initialize(oeProjects);
  }

  /**
   * Singleton instance accessor
   * @returns OpenEdgeAblExtensionService
   */
  static async getInstance(oeProjects: Map<string, ProjectInfo>): Promise<DataDiggerConfig> {
    if (!DataDiggerConfig.instance) {
      DataDiggerConfig.instance = new DataDiggerConfig(oeProjects);
      await DataDiggerConfig.instance.waitUntilReady();
    }
    return DataDiggerConfig.instance;
  }

  /**
   * Initializes the DataDigger Config
   */
  private async initialize(oeProjects: Map<string, ProjectInfo>) {

    // start filling the ddProjectConfigMap from the given oeProjects
    for (const [projectName, projectInfo] of oeProjects) {
      const ddProject: DataDiggerProject = {
        projectName: projectName,
        projectDir: projectInfo.projectRoot,
        dlcHome: projectInfo.dlcHome,
        oeVersion: projectInfo.oeVersion,
        dbConnections: projectInfo.dbConnections,
        dataDiggerPath: ""
      };
      const projectUri: vscode.Uri = vscode.Uri.file(projectInfo.projectRoot);
      const relativeDiggerPath : string | undefined = this.getDiggerPathForProject(projectUri);
      let diggerPath   ;
      //console.log("process.cwd():", process.cwd());
      let message: string = "";
      if (relativeDiggerPath) {
        diggerPath = path.resolve(projectUri.fsPath, relativeDiggerPath);
        if (!fs.existsSync(diggerPath)) {
          message = "--> not found!";
        }
      } else {
        message = "--> not found!"
      }
      console.log(`[abl-datadigger] DataDigger path for project '${projectName}': ${diggerPath} ${message}`);

      // datadigger path path must be set
      if (!diggerPath) {
        vscode.window.showWarningMessage(
          `No valid DataDigger path found for project '${projectName}'. ` +
          `Please set the path in the settings.`
        );
        continue;
      }

      // datadigger path must exist
      if (!fs.existsSync(diggerPath)) {
        vscode.window.showWarningMessage(
          `The configured DataDigger path '${diggerPath}' for project '${projectName}' does not exist. ` +
          `Please check the path in the settings.`
        );
        continue;
      }

      ddProject.dataDiggerPath = diggerPath;
      this.ddProjectConfigMap.set(projectName, ddProject);
    } // for loop

    this.initialized = true;
  }

  /**
   * Retrieves the DataDigger path for the given project from the settings
   *
   * @param projectUri
   * @returns DataDigger path or undefined if not set
   */
  private getDiggerPathForProject(projectUri: vscode.Uri): string | undefined {
    // section = undefined → we gebruiken de 'root' (dus key is 'abl.datadigger.path')
    // resource = projectUri → VS Code zoekt automatisch:
    //   WorkspaceFolder setting -> Workspace setting -> User setting
    const config = vscode.workspace.getConfiguration(undefined, projectUri);
    const value = config.get<string>("abl.datadigger.path");
    return value || undefined;
  }

  /**
   * Gets the datadigger project configs for all projects
   *
   * @returns DataDigger project configs
   */
  public getDataDiggerProjects(): Map<string, DataDiggerProject> {
    return this.ddProjectConfigMap;
  }

  /**
   * A constructor cannot be called with async, so we wait until initialization is done
   */
  private async waitUntilReady(): Promise<void> {
    while (!this.initialized) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

}
