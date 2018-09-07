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

import * as acorn from 'acorn';
import * as fs from 'fs';
import * as path from 'path';
import pify from 'pify';

import * as analysis from './detection-functions';
import * as util from './util';

export interface ReadFileP {
  (path: string, encoding: string): Promise<string>;
}

const readFilep: ReadFileP = pify(fs.readFile);

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

export interface PackageGraph<T = null> {
  name: string;
  version: string;
  data: T;
  dependencies: Array<PackageGraph<T>>;
}

export interface PackageLock {
  name: string;
  version: string;
  lockfileVersion: number;
  packageIntegrity?: string;
  preserveSymlinks?: boolean;
  requires?: boolean;
  dependencies?: {[moduleName: string]: Dependency};
}

export interface Dependency {
  version: string;
  integrity?: string;
  resolved?: string;
  bundled?: boolean;
  dev?: boolean;
  optional?: boolean;
  requires?: {[moduleName: string]: string};
  dependencies?: {[moduleName: string]: Dependency};
}

/**
 * Replaces the data of each node in the packageGraph with the Points Of
 * Interest array
 *
 * @param packageGraph the original package graph with data property as the
 *    node's path
 */
export async function populatePOIInPackageGraph(
    packageGraph: PackageGraph<string>):
    Promise<PackageGraph<PointOfInterest[]>> {
  // Get package graphs with POI arrays in data field
  const dependenciesWithPOI: Array<PackageGraph<PointOfInterest[]>> = [];
  await Promise.all(packageGraph.dependencies.map(async (pkg) => {
    const dependencyPOIList: PackageGraph<PointOfInterest[]> =
        await populatePOIInPackageGraph(pkg);
    dependenciesWithPOI.push(dependencyPOIList);
  }));

  // Get the POI list for this current package
  const poiList: PointOfInterest[] = await getPackagePOIList(packageGraph.data);

  // Create new graph using POI list as data and new list of package graphs as
  // dependencies
  const graph: PackageGraph<PointOfInterest[]> = {
    name: packageGraph.name,
    version: packageGraph.version,
    data: poiList,
    dependencies: dependenciesWithPOI
  };
  return graph;
}

/**
 * Gets a packageGraph node's Points of Interest array
 *
 * @param path the path to the packageGraph node
 */
export async function getPackagePOIList(path: string):
    Promise<PointOfInterest[]> {
  const packagePOIList: PointOfInterest[] = [];
  const files = await getJSFiles(path);

  await Promise.all(files.map(async (file) => {
    const content = await util.readFile(file, 'utf8');
    const functionArr: Function[] = [
      analysis.getIOModules, analysis.getArbitraryExecutionMods,
      analysis.unusualUsesOfRequire, analysis.getEvalCalls,
      analysis.getEnvAccesses, analysis.getFunctionClassAccesses,
      analysis.getAccessesToGlobalProps

    ];
    const filePOIList = getPointsOfInterest(content, file, functionArr);
    packagePOIList.push(...filePOIList);
  }));

  return packagePOIList;
}

/**
 * Creates a new packageGraph node with a new data property that contains
 * the path to the package and replaces its dependency property with updated
 * packageGraph nodes
 *
 * @param rootNode the original packageGraph root node
 * @param rootPath the path to the root node
 */
export async function resolvePaths(
    rootNode: PackageGraph, rootPath: string): Promise<PackageGraph<string>> {
  const updatedNodesMap = new Map<string, PackageGraph<string>>();
  const resolvedNodes: Array<PackageGraph<string>> = [];

  await Promise.all(rootNode.dependencies.map(async (child) => {
    const resolvedDependency =
        await resolvePathsRec(child, rootPath, updatedNodesMap);
    resolvedNodes.push(resolvedDependency);
  }));

  const updatedRoot: PackageGraph<string> = {
    name: rootNode.name,
    version: rootNode.version,
    data: rootPath,
    dependencies: resolvedNodes
  };

  return updatedRoot;

  async function resolvePathsRec(
      packageNode: PackageGraph, parentPath: string,
      updatedNodesMap: Map<string, PackageGraph<string>>):
      Promise<PackageGraph<string>> {
    const resolvedNodes: Array<PackageGraph<string>> = [];

    const path: string = await findPath(packageNode.name, parentPath);
    await Promise.all(packageNode.dependencies.map(async (child) => {
      resolvedNodes.push(await resolvePathsRec(child, path, updatedNodesMap));
    }));

    // creates new node if node doesn't exist already
    if (!updatedNodesMap.has(path)) {
      const updatedNode: PackageGraph<string> = {
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
  const moduleFolder = path.join(parentPath, 'node_modules', mod);

  // Checks to see if parentPath/node_modules/moduleName exists. If not call
  // findPath on the directory above
  if ((await util.exists(moduleFolder)) &&
      (await util.stat(moduleFolder)).isDirectory()) {
    return moduleFolder;
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
    const acornTree =
        acorn.parse(contents, {allowHashBang: true, locations: true});
    functionArray.forEach((f) => {
      const subList = f(acornTree, fileName);
      pointsOfInterest.push(...subList);
    });
  } else {
    pointsOfInterest.push(syntaxError);
  }
  return pointsOfInterest;
}

/**
 * Takes in the root directory of a project and returns returns a
 * PackageGraph<null>
 * @param rootDir The project's root directory.
 * Will fail if there is no package.json and package-lock.json in this directory
 */
export async function generatePackageGraph(
    rootDir: string,
    customReadFilep: ReadFileP = readFilep): Promise<PackageGraph> {
  // Step 0: read in package.json and package-lock.json
  const pjsonPath = path.join(rootDir, 'package.json');
  const pjson = await customReadFilep(pjsonPath, 'utf8');
  const packageJson = JSON.parse(pjson);


  const pjsonLockPath = path.join(rootDir, 'package-lock.json');
  const pjsonLock = await customReadFilep(pjsonLockPath, 'utf8');
  const packageLockJson: PackageLock = JSON.parse(pjsonLock);

  // Step 1: Initialize fields
  const rootMap = new Map<string, PackageGraph<null>>();
  const projectName = packageJson.name;
  const projectVersion = packageJson.version;
  const graphHead: PackageGraph = {
    name: projectName,
    version: projectVersion,
    data: null,
    dependencies: []
  };

  rootMap.set(projectName, graphHead);

  // Step 2: Get the top level dependencies of packageLock
  if (!packageLockJson.dependencies) {
    // If there are no dependencies skip the checks below
    return graphHead;
  }
  /*
   * Hoisted dependencies are all the modules able to be depended on by any
   * module in a project. These modules are all the top level objects in
   * packageLockJson.dependencies.
   */
  const hoistedDependencies = Object.keys(packageLockJson.dependencies);

  for (const hoistedDependency of hoistedDependencies) {
    rootMap.set(hoistedDependency, {
      name: hoistedDependency,
      version: packageLockJson.dependencies[hoistedDependency].version,
      data: null,
      dependencies: []
    });
  }

  // Step 3: Add the top level dependencies to graphHead.dependencies
  const rootRequires = Object.keys(packageJson.dependencies);
  for (const requiredModuleName of rootRequires) {
    // Sanity check
    if (!rootMap.has(requiredModuleName)) {
      throw new Error(
          'Dependencies of package.json and package-lock.json do not match');
    }
    graphHead.dependencies.push(rootMap.get(requiredModuleName)!);
  }

  for (const dependency of hoistedDependencies) {
    if (packageLockJson.dependencies[dependency]) {
      generatePackageGraphRec(
          dependency, packageLockJson.dependencies[dependency], [rootMap]);
    }
  }

  return graphHead;

  /**
   * Creates a packageGraph object for a given package
   * @param packageName The name of the package
   * @param packageObject This package's representation in package-lock.json.
   * Contains information regarding what this package requires and its
   * dependencies. It is of type Dependency because it is a dependency of the
   * root project.
   * @param dependenciesMap An array of Maps where the first element is a map of
   * the highest level dependency's names and their corresponding packageGraphs.
   * The next element is a level down and so on.
   */
  function generatePackageGraphRec(
      packageName: string, packageObject: Dependency,
      dependenciesMap: Array<Map<string, PackageGraph>>): PackageGraph {
    // Step 0: Create a map with all of this package's dependencies
    const newMap = new Map<string, PackageGraph>();
    const currentPackageGraph =
        findEntryInMapArray(packageName, dependenciesMap);
    const dependencyKeys: string[] =
        Object.keys(packageObject.dependencies || {});

    // Add each dependency to a map
    for (const dependencyKey of dependencyKeys) {
      if (packageObject.dependencies) {
        if (packageObject.dependencies[dependencyKey]) {
          newMap.set(dependencyKey, {
            name: dependencyKey,
            version: packageObject.dependencies[dependencyKey].version,
            data: null,
            dependencies: []
          });
        }
      }
    }

    dependenciesMap.push(newMap);

    // Step 1: Look at what the current module requires and add that to the
    // dependencies array of our packageGraph
    const requiresKeys = Object.keys(packageObject.requires || {});
    for (const requireKey of requiresKeys) {
      currentPackageGraph.dependencies.push(
          findEntryInMapArray(requireKey, dependenciesMap));
    }

    // Step 2: call this method on each
    for (const dependencyKey of dependencyKeys) {
      if (packageObject.dependencies &&
          packageObject.dependencies[dependencyKey]) {
        generatePackageGraphRec(
            dependencyKey, packageObject.dependencies[dependencyKey],
            dependenciesMap);
      }
    }
    dependenciesMap.pop();
    return currentPackageGraph;
  }
}



function findEntryInMapArray(
    query: string, mapArray: Array<Map<string, PackageGraph>>): PackageGraph {
  for (let mapIndex = mapArray.length - 1; mapIndex >= 0; mapIndex--) {
    if (mapArray[mapIndex].has(query)) {
      return mapArray[mapIndex].get(query)!;
    }
  }

  throw new Error('Module Not Found in Map Array');
}
