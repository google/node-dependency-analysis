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

export interface PackageTree {
  rootPackageName: string;
  version: string;
  data: PointOfInterest[];
  dependencies: PackageTree[];
}

function getDependencies(pjson: string): PackageTree {
  // todo -- this function will probably be recursive
  throw new Error('not implemented');
  // compute result
  //   let result: PackageTree;
  //   return result;
}

function getPOIforPackageTree(packageTree: PackageTree): PackageTree {
  // TODO:
  throw new Error('not implemented');
  // step 1: get POI modules for current package
  // step 2: add POI to PackageTree Object
}

function getPackagePOIList(pkg: PackageTree): PointOfInterest[] {
  // TODO:
  // calls getPointsOfInterest for each file in package
  throw new Error('not implemented');
}

// Gets Points of Interest for a single file
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
  // const myPackageTree = getDependencies(require('./package.json'));
  // const myIOAnnotatedPackageTree = getIOModules(myPackageTree);
  // print(myIOAnnotatedPackageTree);
  throw new Error('not implemented');
}
