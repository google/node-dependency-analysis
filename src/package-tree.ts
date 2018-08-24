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
import * as path from 'path';

import * as analysis from './analysis';
import * as util from './util';

export interface ReadFileP {
  (path: string, encoding: string): Promise<string>;
}

export interface PointOfInterest {
  type: string;
  fileName: string;
  position: Position;
}

export interface Position {
  lineStart: number;
  lineEnd: number;
  colStart: number;
  colEnd: number;
}

export interface PackageTree<T = null> {
  name: string;
  version: string;
  data: T;
  dependencies: Array<PackageTree<T>>;
}

/**
 * Takes in the root directory of a project and returns returns a PackageTree
 */
export async function generatePackageTree(
    rootDir: string,
    customReadFilep: ReadFileP = util.readFile): Promise<PackageTree<null>> {
  // Step 0: read in package.json and package-lock.json
  const pjsonPath = path.join(rootDir, 'package.json');
  const pjson = await customReadFilep(pjsonPath, 'utf8');
  const packageJson = JSON.parse(pjson);

  const pjsonLockPath = path.join(rootDir, 'package-lock.json');
  const pjsonLock = await customReadFilep(pjsonLockPath, 'utf8');
  const packageLockJson = JSON.parse(pjsonLock);

  // Step 1: Get the top level dependencies from pjson
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  // Step 2: Look at package-lock.json to find dependendencies
  const result =
      await getPackageTreeFromDependencyList(dependencies, packageLockJson);

  const treeHead: PackageTree = {
    name: packageJson.name,
    version: packageJson.version,
    data: null,
    dependencies: result
  };

  return treeHead;
}

/**
 * Replaces the data of each node in the packageTree with the Points Of
 * Interest array
 *
 * @param packageTree the original package tree with data property as the
 *    node's path
 */
export async function populatePOIInPackageTree(
    packageTree: PackageTree<string>): Promise<PackageTree<PointOfInterest[]>> {
  // Get package trees with POI arrays in data field
  const dependenciesWithPOI: Array<PackageTree<PointOfInterest[]>> = [];
  await Promise.all(packageTree.dependencies.map(async (pkg) => {
    const dependencyPOIList: PackageTree<PointOfInterest[]> =
        await populatePOIInPackageTree(pkg);
    dependenciesWithPOI.push(dependencyPOIList);
  }));

  // Get the POI list for this current package
  const poiList: PointOfInterest[] = await getPackagePOIList(packageTree.data);

  // Create new tree using POI list as data and new list of package trees as
  // dependencies
  const tree: PackageTree<PointOfInterest[]> = {
    name: packageTree.name,
    version: packageTree.version,
    data: poiList,
    dependencies: dependenciesWithPOI
  };
  return tree;
}

/**
 * Gets a packageTree node's Points of Interest array
 *
 * @param path the path to the packageTree node
 */
export async function getPackagePOIList(path: string):
    Promise<PointOfInterest[]> {
  const packagePOIList: PointOfInterest[] = [];
  const files = await getJSFiles(path);

  await Promise.all(files.map(async (file) => {
    const content = await util.readFile(file, 'utf8');
    const functionArr: Function[] = [
      analysis.getIOModules, analysis.getDynamicEval, analysis.getEvalCalls,
      analysis.getEnvAccesses
    ];
    const filePOIList = getPointsOfInterest(content, file, functionArr);
    packagePOIList.push(...filePOIList);
  }));

  return packagePOIList;
}

/**
 * Creates a new packageTree node with a new data property that contains
 * the path to the package and replaces its dependency property with updated
 * packageTree nodes
 *
 * @param rootNode the original packageTree root node
 * @param rootPath the path to the root node
 */
export async function resolvePaths(
    rootNode: PackageTree, rootPath: string): Promise<PackageTree<string>> {
  const updatedNodesMap = new Map<string, PackageTree<string>>();
  const resolvedNodes: Array<PackageTree<string>> = [];

  await Promise.all(rootNode.dependencies.map(async (child) => {
    const resolvedDependency =
        await resolvePathsRec(child, rootPath, updatedNodesMap);
    resolvedNodes.push(resolvedDependency);
  }));

  const updatedRoot: PackageTree<string> = {
    name: rootNode.name,
    version: rootNode.version,
    data: rootPath,
    dependencies: resolvedNodes
  };

  return updatedRoot;

  async function resolvePathsRec(
      packageNode: PackageTree, parentPath: string,
      updatedNodesMap: Map<string, PackageTree<string>>):
      Promise<PackageTree<string>> {
    const resolvedNodes: Array<PackageTree<string>> = [];

    const path: string = await findPath(packageNode.name, parentPath);
    await Promise.all(packageNode.dependencies.map(async (child) => {
      resolvedNodes.push(await resolvePathsRec(child, path, updatedNodesMap));
    }));

    // creates new node if node doesn't exist already
    if (!updatedNodesMap.has(path)) {
      const updatedNode: PackageTree<string> = {
        name: packageNode.name,
        version: packageNode.version,
        data: path,
        dependencies: resolvedNodes
      };
      updatedNodesMap.set(path, updatedNode);
      return updatedNode;
    } else {
      return updatedNodesMap.get(path)!;
    }
  }
}

/**
 * Gets the package path based on the location of the parent package
 *
 * @param mod the package/module
 * @param parentPath the path of the parent package that depends on mod
 */
export async function findPath(
    mod: string, parentPath: string): Promise<string> {
  const moduleFolder = path.join(parentPath, 'node_modules');
  if ((await util.exists(moduleFolder)) &&
      (await util.stat(moduleFolder)).isDirectory()) {
    const filesInFolder = await util.readdir(moduleFolder);
    if (filesInFolder.includes(mod)) {
      return path.join(moduleFolder, mod);
    }
  }
  let currPath = path.dirname(parentPath);
  while (!(await util.readdir(currPath)).includes('package.json')) {
    currPath = path.dirname(currPath);
  }
  return findPath(mod, currPath);
}

/**
 * Gets all the javascript files in a package's directory
 *
 * @param path the package's directory path
 */
export async function getJSFiles(dirPath: string): Promise<string[]> {
  const topLevelFiles: string[] = await util.readdir(dirPath, 'utf8');
  const fileList: string[] = [];

  await Promise.all(topLevelFiles.map(async (file) => {
    const currFile = path.join(dirPath, file);
    if (file.endsWith('.js')) {
      fileList.push(currFile);
    } else if (
        (await util.stat(currFile)).isDirectory() && file !== 'node_modules') {
      const subArr = await getJSFiles(currFile);
      fileList.push(...subArr);
    }
  }));
  return fileList;
}

/**
 * Returns all the Points of Interest in a single js file
 *
 * @param contents the contents of the js file
 * @param fileName the name of the file
 * @param functionArray the list of detection functions that will be used to
 *  find the Points of Interests
 */
function getPointsOfInterest(
    contents: string, fileName: string,
    functionArray: Function[]): PointOfInterest[] {
  const pointsOfInterest: PointOfInterest[] = [];
  const syntaxError = analysis.getSyntaxError(contents, fileName);

  // If there are no syntax errors, then use the other detection functions
  if (!syntaxError) {
    functionArray.forEach((f) => {
      const subList = f(contents, fileName);
      pointsOfInterest.push(...subList);
    });
  } else {
    pointsOfInterest.push(syntaxError);
  }
  return pointsOfInterest;
}

/**
 * Takes in a list of depndencies and returns a constructed PackageTree
 * @param packageLockJson the package-lock.json file of the root project
 */
export async function getPackageTreeFromDependencyList(
    dependencies: {}, packageLockJson: {}): Promise<PackageTree[]> {
  // Step 1: For each dependency create a PackageTree obj with the name and
  // version fields populated
  if (!dependencies) {
    return [];
  }

  const dependencyArr: Array<[string, string]> = Object.entries(dependencies);
  const packageTreeArr: PackageTree[] = [];

  dependencyArr.forEach((element: [string, string]) => {
    const pkgTreeObj: PackageTree =
        {name: element[0], version: element[1], data: null, dependencies: []};

    packageTreeArr.push(pkgTreeObj);
  });

  // Step 2: For each Package Tree obj get the dependencies
  await Promise.all(packageTreeArr.map(async element => {
    element.dependencies = await populateDependencies(element, packageLockJson);
  }));

  return packageTreeArr.sort(compare);
}

/**
 * Takes in a PackageTree and populates its dependency field
 * Currently using 'any' type for pjsonLock because the types for
 * package-lock.json have not been written yet
 */
async function populateDependencies(
    pkg: PackageTree,
    // tslint:disable-next-line:no-any
    packageLockJson: any): Promise<PackageTree[]> {
  const packageName = pkg.name;
  if (!packageLockJson.dependencies[packageName]) {
    return [];
  }
  const dependencies = packageLockJson.dependencies[packageName].requires;
  if (!dependencies) {
    return [];
  }

  return await getPackageTreeFromDependencyList(dependencies, packageLockJson);
}

function compare(a: PackageTree, b: PackageTree): number {
  if (a.name < b.name) {
    return -1;
  }
  if (a.name > b.name) {
    return 1;
  }
  return 0;
}
