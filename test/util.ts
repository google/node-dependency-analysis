/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import execa from 'execa';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import {join} from 'path';
import pify from 'pify';
import * as tmp from 'tmp';

// The types for mkdirp are not defined correctly, once fixed this should be
// removed.
// tslint:disable-next-line:no-any
const mkdirpP = pify((mkdirp as any).mkdirp);
const writeFileP = pify(fs.writeFile) as typeof fs.promises.writeFile;

interface PackageJson {
  name: string;
  version: string;
  main?: string;
  dependencies: {[key: string]: string;};
  containedFiles: FileDetails[];
}

interface FileDetails {
  filePath: string;
  contents: string;
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
                                      acc[dependencyDetails.name] =
                                          join('..', dep);
                                      return acc;
                                    },
                                    {} as {
                                      [key: string]: string;
                                    }),
                                containedFiles: []
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
    const path = await new Promise<string>((resolve, reject) => {
      tmp.dir(
          {unsafeCleanup: true, keep: true}, (err, path, cleanupCallback) => {
            if (err) {
              reject(err);
              return;
            }
            this.cleanupCallbacks.push(cleanupCallback);
            resolve(path);
          });
    });
    await Promise.all(this.packageJsons.map(async pJson => {
      const dirname = join(path, NVT.stringify(pJson));
      await mkdirpP(dirname);
      await writeFileP(
          join(dirname, 'package.json'), JSON.stringify(pJson, null, 2));
      await writeFileP(
          join(dirname, 'index.js'),
          `module.exports = '${pJson.name}@${pJson.version}';`);
      await this.createExtraFiles(pJson.containedFiles, dirname);
    }));
    // main package.json file
    await writeFileP(
        join(path, 'package.json'),
        JSON.stringify(
            {
              name: 'test-project',
              version: '0.0.0',
              dependencies: this.topLevelDependencies.reduce(
                  (acc, dep) => {
                    const dependencyDetails = NVT.parse(dep);
                    // join() eliminates dot here, so use string interp.
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
  }

  /**
   * Creates the extra files added with the addFile() method
   */
  private async createExtraFiles(
      containedFiles: FileDetails[], dirname: string) {
    await Promise.all(containedFiles.map(async (file) => {
      await mkdirpP(path.dirname(join(dirname, file.filePath)));
      await writeFileP(join(dirname, file.filePath), file.contents);
    }));
  }

  /**
   * Searches for a module in packageJsons then adds a new file
   * object to its containedFiles array
   * Both the name and version of the module have to match,
   * otherwise an error will be thrown
   * @param filePath The path where this file should be located relative to the
   * root directory of the module
   * @param fileContents The contents of the file being written
   * @param isMain if this option is set to true then the file will be set as
   * the main file in this module's package.json
   */
  addFile(
      module: NameVersionTuple, filePath: string, fileContents: string,
      isMain = false) {
    const moduleInfo = NVT.parse(module);
    for (const pkg of this.packageJsons) {
      if (pkg.name === moduleInfo.name && pkg.version === moduleInfo.version) {
        pkg.containedFiles.push({filePath, contents: fileContents});
        if (isMain) {
          pkg.main = filePath;
        }
        // Return this so that we can chain adding files together
        // ie: addFile().addFile().addFile()
        return this;
      }
    }
    // If this point is reached the module doesn't exist in this project
    throw new Error(`${module} not found`);
  }

  /**
   * Cleans up all previous test projects created from this instance.
   */
  async cleanup(): Promise<void> {
    this.cleanupCallbacks.map(f => f());
    this.cleanupCallbacks.length = 0;
  }
}
