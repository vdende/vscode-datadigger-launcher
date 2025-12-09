import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ProjectInfo } from "../oeabl/ProjectInfo";
import { OpenEdgeAblExtensionService } from "../oeabl/OpenEdgeAblExtension";
import { DataDiggerProject } from "./DataDiggerProject";
import { Logger } from "../util/Logger";
import { spawn } from "child_process";

export class DataDiggerConfig {

  private static instance: DataDiggerConfig | undefined;

  private ddProjectConfigMap: Map<string, DataDiggerProject> = new Map();
  private initialized = false;

  /**
   * Constructor
   */
  private constructor() {
    this.initialize();
  }

  /**
   * Singleton instance accessor
   * @returns DataDiggerConfig object
   */
  static async getInstance(): Promise<DataDiggerConfig> {
    if (!DataDiggerConfig.instance) {
      DataDiggerConfig.instance = new DataDiggerConfig();
      await DataDiggerConfig.instance.waitUntilReady();
    }
    return DataDiggerConfig.instance;
  }

  /**
   * Initializes the DataDigger Config
   */
  private async initialize() {

    Logger.info("Reading ABL projects and locating DataDigger instances");

    // Riverside dependency check - and get project infos
    const ablExt     : OpenEdgeAblExtensionService = await OpenEdgeAblExtensionService.getInstance();
    const oeProjects : Map<string, ProjectInfo>    = await ablExt.getProjectInfos();

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

      const projectUri         : vscode.Uri         = vscode.Uri.file(projectInfo.projectRoot);
      const relativeDiggerPath : string | undefined = this.getDiggerPathForProject(projectUri);
      let diggerPath;

      if (relativeDiggerPath) {
        diggerPath = path.resolve(projectUri.fsPath, relativeDiggerPath);
        if (fs.existsSync(diggerPath)) {
          Logger.info(`DataDigger path for project '${projectName}': ${diggerPath}`);
        } else {
          Logger.warn(`DataDigger path for project '${projectName}': ${diggerPath} --> not found!`);
        }
      } else {
        Logger.warn(`DataDigger path for project '${projectName}': ${diggerPath} --> not found!`);
      }

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
   * Clears the Map and Instance
   *
   * @returns DataDigger project configs
   */
  public clear(): void {
    this.ddProjectConfigMap.clear();
    DataDiggerConfig.instance = undefined;
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
   * Start DataDigger for project
   *
   * @param config DataDiggerProject object
   */
  public async startDataDigger(config: DataDiggerProject, context: vscode.ExtensionContext): Promise<void> {
    Logger.info(`Start DataDigger for project '${config.projectName}'`);

    const prowin : string = `${config.dlcHome}/bin/prowin.exe`;
    Logger.debug(`prowin: ${prowin}`);
    Logger.debug(`DataDiggerPath: ${config.dataDiggerPath}`);

    const cfgFile = this.writeStartConfigJson(config);
    const wrapper = context.asAbsolutePath(path.join("resources", "ddwrapper.p"));

    // add DataDigger.pf first, and all following parameters will override the previous (if exists)
    const args = [
      "-pf", `${config.dataDiggerPath}/DataDigger.pf`,
      ...config.dbConnections.flatMap(conn => conn.split(" ")),
      "-nosplash",
      "-param", cfgFile,
      "-p", wrapper,
      "-T", os.tmpdir()
    ];
    Logger.debug(`Arguments: ${args}`)

    const child = spawn(prowin, args, {
      cwd: config.projectDir,
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });

    child.unref();
  }

  /**
   * Write a json file to be passed as parameter
   *
   * @param config
   * @returns
   */
  private writeStartConfigJson(config: DataDiggerProject): string {
    const configFile = path.join(os.tmpdir(), `abldd_${Date.now()}.json`);
    const clientLog  = path.join(os.tmpdir(), `dd_client_${config.projectName}.log`);

    const cfgJson = {
      "dataDiggerPath": config.dataDiggerPath,
      "clientLog": clientLog
    };

    Logger.info(`DataDigger client logfile: ${clientLog}`);

    fs.writeFileSync(configFile, JSON.stringify(cfgJson, null, 2), { encoding: "utf-8" });

    return configFile;
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
