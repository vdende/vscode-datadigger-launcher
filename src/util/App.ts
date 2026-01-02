import * as vscode from "vscode";
import * as path from "path";

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
    const regex = /(?:[^\s"'"]+|"[^"]*"|'[^']*')+/g;
    const matches = input.match(regex);

    if (!matches) {
      return [];
    }

    return matches.map(arg => {
      if (
        (arg.startsWith('"') && arg.endsWith('"')) ||
        (arg.startsWith("'") && arg.endsWith("'"))
      ) {
        return arg.slice(1, -1);
      }
      return arg;
    });
  }

  /**
   * Get the full path of the bundled DataDigger path
   *
   * @returns DataDigger full path
   */
  public static BundledDataDiggerPath(): string {
    return App.ctx.asAbsolutePath(path.join("resources", "DataDigger"));
  }

}
