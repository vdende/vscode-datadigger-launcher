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
        dataDiggerPath: "",
        projectParameters: "",
        extraParameters: ""
      };

      const projectUri         : vscode.Uri         = vscode.Uri.file(projectInfo.projectRoot);
      const relativeDiggerPath : string             = this.getDataDiggerPathForProject(projectUri);
      const extraParameters    : string | undefined = this.getExtraParametersForProject(projectUri);

      const diggerPath = this.validateDataDiggerPath(relativeDiggerPath, projectName);
      if (diggerPath === undefined) {
        continue;
      }

      if (vscode.workspace.getConfiguration(undefined, projectUri).get<boolean>("abl.datadiggerLauncher.addProjectParameters")) {
        ddProject.projectParameters = projectInfo.projectParameters;
      }

      ddProject.dataDiggerPath  = diggerPath;
      ddProject.extraParameters = extraParameters || "";
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
  private getDataDiggerPathForProject(projectUri: vscode.Uri): string {
    // First parameter 'section': undefined --> we don't want a section, we provide full-key in the config.get()
    // Second parameter 'scope' : projectUri ==> VSCode searches automatically:
    //     ProjectFolder setting -> Workspace setting -> User setting
    const config = vscode.workspace.getConfiguration(undefined, projectUri);
    const value  = config.get<string>("abl.datadiggerLauncher.path");

    // only when the value is empty, we'll use the DataDigger in the box
    if (!value || value === "") {
      return App.BundledDataDiggerPath();
    }

    return value;
  }

  /**
   * Validates the DataDigger path from Settings (path can be relative or absolute)
   *
   * @param ddPath (can be realtive or absolute)
   * @returns Absolute path
   */
  private validateDataDiggerPath(ddPath: string | undefined, projectName: string): string | undefined {

    const inputPath = ddPath;

    if (!ddPath || ddPath.trim() === "") {
      Logger.warn(`DataDigger path for project '${projectName}': ${ddPath} --> not found`);
      vscode.window.showWarningMessage(
        `No valid DataDigger path found for project '${projectName}'. ` +
        `Please set the path in the settings.`
      );
      return undefined;
    }

    if (!path.isAbsolute(ddPath)) {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        throw new Error("No workspace is open!");
      }
      ddPath = path.resolve(ws.uri.fsPath, ddPath);
    }

    if (!fs.existsSync(ddPath)) {
      Logger.warn(`DataDigger path for project '${projectName}': ${inputPath} --> not found`);
      vscode.window.showWarningMessage(
        `No valid DataDigger path found for project '${projectName}'. ` +
        `Please set the path in the settings.`
      );
      return undefined;
    }

    const stat = fs.statSync(ddPath);
    if (!stat.isDirectory()) {
      Logger.error(`DataDigger path for project '${projectName}': ${inputPath} --> not a directory`);
      vscode.window.showErrorMessage(
        `DataDigger path for project '${projectName}' must be a directory. ` +
        `Please set the path in the settings.`
      );
      return undefined;
    }

    if (!fs.existsSync(path.join(ddPath, "DataDigger.pf"))) {
      Logger.error(`DataDigger path for project '${projectName}': ${inputPath} --> DataDigger.pf not found`);
      vscode.window.showErrorMessage(
        `DataDigger path for project '${projectName}' does not contain 'DataDigger.pf'. ` +
        `Please set the path in the settings.`
      );
      return undefined;
    }

    Logger.info(`DataDigger path for project '${projectName}': ${ddPath}`);

    return ddPath;
  }

  /**
   * Retrieves the extra parameters to start DataDigger
   *
   * @param projectUri
   * @returns Extra parameters from settings
   */
  private getExtraParametersForProject(projectUri: vscode.Uri): string | undefined {
    // First parameter 'section': undefined --> we don't want a section, we provide full-key in the config.get()
    // Second parameter 'scope' : projectUri ==> VSCode searches automatically:
    //     ProjectFolder setting -> Workspace setting -> User setting
    const config = vscode.workspace.getConfiguration(undefined, projectUri);
    const value  = config.get<string>("abl.datadiggerLauncher.extraParameters");

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

    let prowin : string = `${config.dlcHome}/bin/prowin.exe`;
    if (!fs.existsSync(`${prowin}`)) {
      prowin = `${config.dlcHome}/bin/prowin32.exe`;
    }
    Logger.debug(`prowin: ${prowin}`);
    if (!fs.existsSync(prowin)) {
      vscode.window.showErrorMessage(`Executable not found: ${prowin}`);
      Logger.error(`Executable '${prowin}' does not exist!`);
      return;
    }
    Logger.debug(`DataDiggerPath: ${config.dataDiggerPath}`);

    const wrapper = App.ctx.asAbsolutePath(path.join("resources", "ddwrapper.p"));

    // add DataDigger.pf first, and all following parameters will override the previous (if exists)
    const args = [
      "-pf", `${config.dataDiggerPath}/DataDigger.pf`,
      ...config.dbConnections.flatMap(conn => conn.split(" ")),
      "-param", config.projectName,
      "-T", os.tmpdir(),
      ...App.parseArgs(config.projectParameters),
      ...App.parseArgs(config.extraParameters),
      "-p", wrapper
    ];
    Logger.debug(`Arguments: ${args}`)

    const workPath: string = this.prepareUserWorkPath(config);
    Logger.debug(`WorkPath: ${workPath}`);

    if (!fs.existsSync(workPath)) {
      vscode.window.showErrorMessage(`WorkPath not found: ${workPath}`);
      Logger.error(`WorkPath '${workPath}' does not exist!`);
      return;
    }

    const child = spawn(prowin, args, {
      cwd: config.projectDir,
      detached: true,
      stdio: [ "ignore", "pipe", "pipe" ],
      windowsHide: false,
      env: {
        ...process.env,
        DD_PATH: config.dataDiggerPath,
        DD_WORKDIR: workPath
      }
    });

    let stdoutBuf = "";
    let stderrBuf = "";

    child.stdout?.on("data", data => {
      stdoutBuf += data.toString();
    });

    child.stderr?.on("data", data => {
      stderrBuf += data.toString();
    });

    child.on("spawn", () => {
      Logger.debug(`Started ${path.basename(prowin)} (pid=${child.pid}) detached`);
    });

    child.on("error", err => {
      vscode.window.showErrorMessage("Failed to start DataDigger (see Output)");
      Logger.error(`Failed to start DataDigger: ${err}`);
    });

    child.on("close", (code, signal) => {
      if (stderrBuf.trim()) {
        Logger.error(`stderr: ${stderrBuf.trim()}`);
      }
      if (stdoutBuf.trim()) {
        Logger.warn(`stdout: ${stdoutBuf.trim()}`);
      }

      if (code !== 0 || stderrBuf.length > 0) {
        Logger.error(`prowin exited, code=${code}, signal=${signal ?? "none"}`);
        vscode.window.showErrorMessage("Failed to start DataDigger (see Output)");
      } else {
        Logger.debug(`prowin exited, code=${code}, signal=${signal ?? "none"}`);
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
    // when a custom DD-dir is set, use that as the workPath
    if (config.dataDiggerPath !== App.BundledDataDiggerPath()) {
      return config.dataDiggerPath || "";
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
