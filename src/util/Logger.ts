import * as vscode from "vscode";

export class Logger {

  private static channel = vscode.window.createOutputChannel("ABL DataDigger");
  private static showDebug: boolean = false;

  /**
   * Reload configuration (when settings are changed)
   */
  static reloadConfiguration() {
    const config = vscode.workspace.getConfiguration("abl.datadigger");
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

    if (level === "error") {
      this.channel.show(true);
    }
  }

  /**
   * Info message
   *
   * @param message
   */
  static info(message: string) {
    this.write("info", "ℹ️", message);
  }

  /**
   * Warn message
   *
   * @param message
   */
  static warn(message: string) {
    this.write("warn", "⚠️", message);
  }

  /**
   * Error message
   * @param message
   */
  static error(message: string) {
    this.write("error", "❌", message);
  }

  /**
   * Debug message
   * @param message
   */
  static debug(message: string) {
    if (!this.showDebug) return;
    this.write("debug", "🐞", message);
  }

  /**
   * Show the log view
   */
  static show() {
    this.channel.show(true);
  }
}
