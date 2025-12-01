import * as vscode from 'vscode';
import { ProjectInfo } from './ProjectInfo';

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
     * A constructor cannot be called with async, so we wait until initialization is done
     */
    private async waitUntilReady(): Promise<void> {
        while (!this.initialized) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
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
                const info   = (await this.api.getProjectInfo(folderString)) as ProjectInfo;
                const dlc    = (await vscode.commands.executeCommand("abl.getDlcDirectory", folderPath)) as string;
                info.dlcHome = dlc;
                // key = folderName
                this.projectInfoMap.set(folder.name, info);
                console.log(`[abl-datadigger] Project info loaded for: ${folder.name}`);
            } catch (err) {
                console.error("[abl-datadigger] Error while executing getProjectInfo:", err);
            }
        }

        //for (const [key, value] of this.projectInfoMap.entries()) {
        //    console.log(`[abl-datadigger] - ${key}: ${JSON.stringify(value)}`);
        //}
        
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
     * Gets the project info for the given project URI
     * 
     * @param projectUri 
     * @returns ProjectInfo
     */
    public async getProjectInfos(): Promise<Map<string, ProjectInfo>> {
        return this.projectInfoMap
    }

}
