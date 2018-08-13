import * as path from 'path';

import {getDynamicEval, getIOModules} from './analysis';
import {fileInfo, filesInDir, readFile} from './util';

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

export interface PackageTree<T> {
  name: string;
  version: string;
  data: T;
  dependencies: Array<PackageTree<T>>;
}

export function generatePackageTree(pjson: string):
    PackageTree<PointOfInterest[]> {
  throw new Error('not implemented');
  // compute result
  //   let result: PackageTree;
  //   return result;
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
    const content = await readFile(file, 'utf8');
    const functionArr: Function[] = [getIOModules, getDynamicEval];
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
    rootNode: PackageTree<null>,
    rootPath: string): Promise<PackageTree<string>> {
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
      packageNode: PackageTree<null>, parentPath: string,
      updatedNodesMap: Map<string, PackageTree<string>>):
      Promise<PackageTree<string>> {
    const paths: string[] = [];
    const resolvedNodes: Array<PackageTree<string>> = [];

    paths.push(parentPath);
    let currPath = path.dirname(require.resolve(packageNode.name, {paths}));

    while (!(await filesInDir(currPath)).includes('package.json')) {
      currPath = path.dirname(require.resolve(packageNode.name, {paths}));
    }

    await Promise.all(packageNode.dependencies.map(async (child) => {
      resolvedNodes.push(
          await resolvePathsRec(child, currPath, updatedNodesMap));
    }));

    // creates new node if node doesn't exist already
    if (!updatedNodesMap.has(currPath)) {
      const updatedNode: PackageTree<string> = {
        name: packageNode.name,
        version: packageNode.version,
        data: currPath,
        dependencies: resolvedNodes
      };
      updatedNodesMap.set(currPath, updatedNode);
      return updatedNode;
    } else {
      return updatedNodesMap.get(currPath)!;
    }
  }
}

/**
 * Gets all the javascript files in a package's directory
 *
 * @param path the package's directory path
 */
export async function getJSFiles(dirPath: string): Promise<string[]> {
  const topLevelFiles: string[] = await filesInDir(path, 'utf8');
  const fileList: string[] = [];

  await Promise.all(topLevelFiles.map(async (file) => {
    const currFile = path.join(dirPath, file);
    if (file.endsWith('.js')) {
      fileList.push(currFile);
    } else if (
        (await fileInfo(currFile)).isDirectory() && file !== 'node_modules') {
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
  functionArray.forEach((f) => {
    const subList = f(contents, fileName);
    pointsOfInterest.push(subList);
  });
  return pointsOfInterest;
}

function main() {
  // TODO:
  // const emptyPackageTree: PackageTree<null> = (TODO: function that creates
  //                                            package tree with data as null)
  // const packageTreeWithPath = resolvePaths(emptyPackageTree, <CLI INPUT>);
  // const packageTreeWithPOI = populatePOIInPackageTree(packageTreeWithPath);
  throw new Error('not implemented');
}
