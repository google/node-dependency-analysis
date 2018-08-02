interface PointOfInterest {
  type: string;
  filename: string;
  lineNum: number;
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

function getPackagePOIList(package: PackageTree): PointOfInterest[] {
  // TODO:
  // calls getPointsOfInterest for each file in package
  throw new Error('not implemented');
}

// Gets Points of Interest for a single file
function getPointsOfInterest(
    contents: string, fileName: string,
    functionArray: POIDetector[]): PointOfInterest[] {
  // TODO:
  throw new Error('not implemented');

  // const pointsOfInterest: PointOfInterest[] = [];
  // functionArray.forEach((f)=> pointsOfInterest.push(...f(contents,
  // fileName))); return pointsOfInterest;
}

function main() {
  // TODO:
  // const myPackageTree = getDependencies(require('./package.json'));
  // const myIOAnnotatedPackageTree = getIOModules(myPackageTree);
  // print(myIOAnnotatedPackageTree);
  throw new Error('not implemented');
}
