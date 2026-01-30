import * as vscode from "vscode";

export class Logger {

  private static channel: vscode.OutputChannel = vscode.window.createOutputChannel("ABL DataDigger Launcher");
  private static showDebug: boolean = false;

  /**
   * Reload configuration (when settings are changed)
   */
  public static reloadConfiguration() {
    const config = vscode.workspace.getConfiguration("abl.datadiggerLauncher");
    this.showDebug = config.get<boolean>("debugLogging", false);
    this.info(`Debug logging is now ${this.showDebug ? "ENABLED" : "DISABLED"}`);
  }

  /**
   * Generic write function
   *
   * @param level
   * @param message
   */
  private static write(level: string, icon: string, message: string) {
    const timestamp = new Date().toISOString();
    this.channel.appendLine(`${timestamp} ${icon} [${level}] ${message}`);
  }

  /**
   * Info message
   *
   * @param message
   */
  public static info(message: string) {
    this.write("info", "ℹ️", message);
  }

  /**
   * Warn message
   *
   * @param message
   */
  public static warn(message: string) {
    this.write("warn", "⚠️", message);
  }

  /**
   * Error message
   * @param message
   */
  public static error(message: string) {
    this.write("error", "❌", message);
    this.channel.show(true);
  }

  /**
   * Debug message
   * @param message
   */
  public static debug(message: string) {
    if (!this.showDebug) { return; }
    this.write("debug", "🐞", message);
  }
}
