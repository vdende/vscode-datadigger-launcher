import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ProjectInfo } from "../oeabl/ProjectInfo";
import { OpenEdgeAblExtensionService } from "../oeabl/OpenEdgeAblExtension";
import { DataDiggerProject } from "./DataDiggerProject";
import { Logger } from "../util/Logger";
import { spawn } from "child_process";
import { App } from "../util/App";

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
          Logger.warn(`DataDigger path for project '${projectName}': ${diggerPath} --> not found`);
        }
      } else {
        Logger.warn(`DataDigger path for project '${projectName}': ${diggerPath} --> not found`);
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
    // First parameter 'section': undefined --> we don't want a section, we provide full-key in the config.get
    // Second parameter 'scope' : projectUri ==> VSCode searches automatically
    //     ProjectFolder setting -> Workspace setting -> User setting
    const config = vscode.workspace.getConfiguration(undefined, projectUri);
    const value  = config.get<string>("abl.datadigger.path");

    // only when the value is empty, we'll use the DataDigger in the box
    if (value === "") {
      return App.ctx.asAbsolutePath(path.join("resources", "DataDigger"));
    }

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
  public async startDataDigger(config: DataDiggerProject): Promise<void> {
    Logger.info(`Start DataDigger for project '${config.projectName}'`);

    const prowin : string = `${config.dlcHome}/bin/prowin.exe`;
    Logger.debug(`prowin: ${prowin}`);
    Logger.debug(`DataDiggerPath: ${config.dataDiggerPath}`);

    const wrapper = App.ctx.asAbsolutePath(path.join("resources", "ddwrapper.p"));

    // add DataDigger.pf first, and all following parameters will override the previous (if exists)
    const args = [
      "-pf", `${config.dataDiggerPath}/DataDigger.pf`,
      ...config.dbConnections.flatMap(conn => conn.split(" ")),
      "-nosplash",
      "-param", config.projectName,
      "-p", wrapper,
      "-T", os.tmpdir()
    ];
    Logger.debug(`Arguments: ${args}`)

    const workPath: string = this.prepareUserWorkPath(config);
    Logger.debug(`WorkPath: ${workPath}`);

    const child = spawn(prowin, args, {
      cwd: config.projectDir,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      env: {
        DD_PATH: config.dataDiggerPath,
        DD_WORKDIR: workPath
      }
    });

    child.unref();
  }

  /**
   * We need a user settings folder when the 'global' extension DataDigger path is used
   *
   * @param config
   * @returns path
   */
  private prepareUserWorkPath(config: DataDiggerProject): string {
    // we don't need a workdir when the user has set it to its custom DD-dir
    if (config.dataDiggerPath !== App.ctx.asAbsolutePath(path.join("resources", "DataDigger"))) {
      return "";
    }

    const base     = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const workPath = path.join(base, "Code", "DataDigger", config.projectName)

    if (!fs.existsSync(workPath)) {
      Logger.debug(`Creating DataDigger work directory: ${workPath}`)
    }
    fs.mkdirSync(workPath, { recursive: true });

    return workPath;
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
