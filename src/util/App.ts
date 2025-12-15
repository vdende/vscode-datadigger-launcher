import * as vscode from "vscode";

export class App {

  private static _ctx: vscode.ExtensionContext;

  /**
   * Assign the context property
   *
   * @param ctx
   */
  public static init(ctx: vscode.ExtensionContext): void {
    this._ctx = ctx;
  }

  /**
   * Getter for ctx property
   *
   * @return ExtensionContext
   */
  public static get ctx(): vscode.ExtensionContext {
    // sanity
    if (!this._ctx) {
      throw new Error("App.ctx accessed before activate()");
    }
    return this._ctx;
  }

  /**
   * Parses arguments, removes double whitespaces (but not in quoted strings)
   * and returns an array of all the arguments
   *
   * @param input Arguments
   * @returns Array of the arguments
   */
  public static parseArgs(input: string): string[] {
    const matches = input.match(/(?:[^\s"]+|"[^"]*")+/g);
    if (!matches) {
      return [];
    }

    return matches.map(arg =>
      arg.startsWith('"') && arg.endsWith('"')
        ? arg.slice(1, -1)
        : arg
    );
}

}
