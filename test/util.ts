import execa from 'execa';
import * as fs from 'fs';
import pify from 'pify';
import * as tmp from 'tmp';

const mkdirP = pify(fs.mkdir) as typeof fs.promises.mkdir;
const writeFileP = pify(fs.writeFile) as typeof fs.promises.writeFile;

interface PackageJson {
  name: string;
  version: string;
  dependencies: {[key: string]: string;};
}

class NVT {
  static parse(p: NameVersionTuple): {name: string, version: string} {
    return {name: p.split('@')[0], version: `${p.split('@')[1]}.0.0`};
  }

  static stringify(p: {name: string, version: string}): NameVersionTuple {
    return `${p.name}@${p.version.split('.')[0]}`;
  }
}

/**
 * A string that must be of the form `${validModuleName}@${integer}`. The
 * integer will be used as the major version of the given module name.
 */
export type NameVersionTuple = string;

/**
 * A structure that represents a package's dependency tree. Keys must be either
 * '*' or a NameVersionTuple. Values specify the module's own dependencies.
 */
export type DependencyGraph = {
  [key: string]: NameVersionTuple[];
};

/**
 * A class that represents an ephermeral npm project with a node_modules
 * directory suitable for testing purposes.
 */
export class TestProject {
  private creatingProject: Promise<string> = Promise.resolve('');
  private cleanupCallbacks: Array<() => void> = [];
  private packageJsons: PackageJson[];
  private topLevelDependencies: string[];

  /**
   * Constructs a new TestProject instance.
   * @param graph An object that represents the layout of a dependency graph.
   * The '*' key represents the main package.
   * @example The following snippet:
   * ```
   * new TestProject({
   *   '*': ['a@1', 'c@2'],
   *   'a@1': ['b@1', 'c@1'],
   *   'b@1': ['c@1'],
   *   'c@1': [],
   *   'c@2': []
   * });
   * ```
   */
  constructor(graph: DependencyGraph) {
    this.packageJsons = Object.keys(graph)
                            .filter(a => a !== '*')  // filter out null values
                            .map(key => {
                              const packageDetails = NVT.parse(key);
                              return {
                                name: packageDetails.name,
                                version: packageDetails.version,
                                dependencies: graph[key].reduce(
                                    (acc, dep) => {
                                      const dependencyDetails = NVT.parse(dep);
                                      acc[dependencyDetails.name] = `../${dep}`;
                                      return acc;
                                    },
                                    {} as {
                                      [key: string]: string;
                                    })
                              };
                            }) as PackageJson[];
    this.topLevelDependencies = graph['*'];
  }

  /**
   * Creates the entire test project in a temporary directory, and returns a
   * path to that directory.
   * @example Given that the constructor was called with the example value
   * above, this would do the following:
   * 1. Create this directory structure:
   *   /path/to/tmp/dir
   *   | node_modules
   *   | | a
   *   | | | node_modules
   *   | | | | c [@1.0.0]
   *   | | b
   *   | | | node_modules
   *   | | | | c [@1.0.0]
   *   | | c [@2.0.0]
   * 2. Return /path/to/tmp/dir
   */
  async create(): Promise<string> {
    await this.creatingProject;
    this.creatingProject = new Promise<string>((resolve, reject) => {
                             tmp.dir(
                                 {unsafeCleanup: true, keep: true},
                                 (err, path, cleanupCallback) => {
                                   if (err) {
                                     reject(err);
                                     return;
                                   }
                                   this.cleanupCallbacks.push(cleanupCallback);
                                   resolve(path);
                                 });
                           }).then(async path => {
      await Promise.all(this.packageJsons.map(async pJson => {
        const dirname = `${path}/${NVT.stringify(pJson)}`;
        await mkdirP(dirname);
        await writeFileP(
            `${dirname}/package.json`, JSON.stringify(pJson, null, 2));
        await writeFileP(
            `${dirname}/index.js`, `module.exports = '${pJson.name}@${pJson.version}';`);
      }));
      // main package.json file
      await writeFileP(
          `${path}/package.json`,
          JSON.stringify(
              {
                name: 'test-project',
                version: '0.0.0',
                dependencies: this.topLevelDependencies.reduce(
                    (acc, dep) => {
                      const dependencyDetails = NVT.parse(dep);
                      acc[dependencyDetails.name] = `./${dep}`;
                      return acc;
                    },
                    {} as {
                      [key: string]: string;
                    })
              },
              null, 2));
      await execa('npm', ['install'], {cwd: path});
      return path;
    });
    return await this.creatingProject;
  }

  /**
   * Cleans up all previous test projects created from this instance.
   */
  async cleanup(): Promise<void> {
    await this.creatingProject;
    await this.creatingProject;  // for good measure
    this.cleanupCallbacks.map(f => f());
    this.cleanupCallbacks.length = 0;
  }
}
