import {PackageTree, PointOfInterest} from './package-tree';

export function getNumberOfTransitiveDetections(
    packageTree: PackageTree<PointOfInterest[]>,
    countedDependencies: Map<string, PackageTree<PointOfInterest[]>>): number {
  let totalDependencies = packageTree.data.length;
  packageTree.dependencies.forEach((dep) => {
    if (!countedDependencies.has(`${dep.name} ${dep.version}`)) {
      countedDependencies.set(`${dep.name} ${dep.version}`, dep);
      totalDependencies +=
          getNumberOfTransitiveDetections(dep, countedDependencies);
    }
  });
  return totalDependencies;
}

export function squashDetections(packageTree: PackageTree<PointOfInterest[]>):
    Map<string, number> {
  const sortedDataArray = packageTree.data.sort(compare);
  const squashedDetections: Map<string, number> = new Map();
  for (const point of sortedDataArray) {
    if (squashedDetections.has(point.type)) {
      squashedDetections.set(
          point.type, squashedDetections.get(point.type)! + 1);
    } else {
      squashedDetections.set(point.type, 1);
    }
  }
  return squashedDetections;
}

// Comparison function to sort Points of Interest by type
function compare(a: PointOfInterest, b: PointOfInterest): number {
  if (a.type < b.type) {
    return -1;
  }
  if (a.type > b.type) {
    return 1;
  }
  return 0;
}