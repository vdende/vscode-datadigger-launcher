export interface ProjectInfo {
  buildDirs: string;
  catalog: string;
  encoding: string;
  projectRoot: string;
  propathRCodeCache: string;
  rcodeCache: string;
  schemaCache: string;
  sourceDirs: string;
  xrefDirs: string;
  // custom added
  dlcHome: string;
  oeVersion: string;
  dbConnections: string[];
}
