import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ProjectInfo } from "./ProjectInfo";

export class OpenEdgeAblExtensionService {

  private static instance: OpenEdgeAblExtensionService | undefined;

  private static readonly RIVERSIDE_EXTENSION_ID = "RiversideSoftware.openedge-abl-lsp";
  private api: any;
  private projectInfoMap: Map<string, ProjectInfo> = new Map();
  private initialized = false;

  /**
   * Constructor
   */
  private constructor() {
    this.initialize();
  }

  /**
   * Singleton instance accessor
   * @returns OpenEdgeAblExtensionService
   */
  static async getInstance(): Promise<OpenEdgeAblExtensionService> {
    if (!OpenEdgeAblExtensionService.instance) {
      OpenEdgeAblExtensionService.instance = new OpenEdgeAblExtensionService();
      await OpenEdgeAblExtensionService.instance.waitUntilReady();
    }
    return OpenEdgeAblExtensionService.instance;
  }

  /**
   * Initializes the OpenEdge ABL Extension Service
   */
  private async initialize() {
    const extension = vscode.extensions.getExtension(
      OpenEdgeAblExtensionService.RIVERSIDE_EXTENSION_ID
    );

    if (!extension) {
      throw new Error("Riverside Software - Openedge ABL extension is not installed!");
    }

    if (!extension.isActive) {
      await extension.activate();
    }

    this.api = extension.exports;

    // load project infos
    await this.loadProjectInfos();

    this.initialized = true;
  }

  /**
   * Load project infos for all workspace folders
   */
  private async loadProjectInfos() {
    if (!this.api) return;

    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      throw new Error("There are no OpenEdge projects setup!");
    }

    for (const folder of folders) {
      const folderString = folder.uri.toString(true);
      const folderPath   = folder.uri.fsPath;

      try {
        // get project info from ABL extension API
        const info = (await this.api.getProjectInfo(folderString)) as ProjectInfo;

        // get DLC home and assign it to the project info
        info.dlcHome = (await vscode.commands.executeCommand("abl.getDlcDirectory", folderPath)) as string;

        // get db connections and assign it to the project info
        const oeProjectJsonData = this.parseOpenEdgeProjectJson(folderPath);
        info.dbConnections = this.getDbConnections(oeProjectJsonData);
        info.oeVersion     = oeProjectJsonData.oeversion;

        // only add projects which have db connections
        if (info.dbConnections.length > 0) {
          // key = folderName
          this.projectInfoMap.set(folder.name, info);
          console.log(`[abl-datadigger] Project info loaded for: ${folder.name}`);
        } else {
          console.log(`[abl-datadigger] No DB connections found for project: ${folder.name}. Skipping...`);
        }
      } catch (err) {
        console.error("[abl-datadigger] Error while executing getProjectInfo:", err);
      }
    }

    // console.log("[abl-datadigger] >>>>>>>>>>>>>>>>");
    // for (const [key, value] of this.projectInfoMap.entries()) {
    //  console.log(`[abl-datadigger] - ${key}: ${JSON.stringify(value)}`);
    // }
    // console.log("[abl-datadigger] <<<<<<<<<<<<<<<<");
  }

  /**
   * Parses the openedge-project.json file for the given project path
   *
   * @param projectPath
   */
  private parseOpenEdgeProjectJson(projectPath: string): any {
    // opendge-project.json should exist
    const oeProjectJsonPath : string = path.join(projectPath, "openedge-project.json");
    if (!fs.existsSync(oeProjectJsonPath)) {
      throw new Error(`No 'openedge-project.json' is found in project: ${oeProjectJsonPath}`);
    }

        // read file
    const jsonRaw  = fs.readFileSync(oeProjectJsonPath, "utf8");
    const jsonData = JSON.parse(jsonRaw);

    return jsonData;
  }

  /**
   * Gets the DB connections for the given project URI
   *
   * @param openedge-project.json data
   * @returns DB connections
   */
  private getDbConnections(oeProjectJsonData: any): string[] {

    const connectArray = (oeProjectJsonData.dbConnections ?? [])
      .map((c: any) => c?.connect)
      .filter((x: any): x is string => typeof x === 'string');

    //console.log(`[abl-datadigger] DB Connections for project '${projectPath}': ${connectArray.join(", ")}`);

    return connectArray;
  }

  /**
   * Gets the project info for the given project URI
   *
   * @param projectUri
   * @returns ProjectInfo
   */
  public async getProjectInfo(projectUri: string): Promise<any> {
    return this.api?.getProjectInfo(projectUri);
  }

  /**
   * Gets the project infos for all projects
   *
   * @returns ProjectInfos
   */
  public async getProjectInfos(): Promise<Map<string, ProjectInfo>> {
    return this.projectInfoMap
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
