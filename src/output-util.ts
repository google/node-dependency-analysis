import {PackageGraph, PointOfInterest} from './package-graph';

export function getNumberOfTransitiveDetections(
    packageGraph: PackageGraph<PointOfInterest[]>): number {
  let totalDetections = packageGraph.data.length;
  const countedDependencies =
      new Map<string, PackageGraph<PointOfInterest[]>>();
  packageGraph.dependencies.forEach((dep) => {
    totalDetections +=
        getNumberOfTransitiveDetectionsRec(dep, countedDependencies);
  });
  return totalDetections;


  function getNumberOfTransitiveDetectionsRec(
      packageGraph: PackageGraph<PointOfInterest[]>,
      countedDependencies: Map<string, PackageGraph<PointOfInterest[]>>):
      number {
    let totalDetections = packageGraph.data.length;
    packageGraph.dependencies.forEach((dep) => {
      if (!countedDependencies.has(`${dep.name} ${dep.version}`)) {
        countedDependencies.set(`${dep.name} ${dep.version}`, dep);
        totalDetections +=
            getNumberOfTransitiveDetectionsRec(dep, countedDependencies);
      }
    });
    return totalDetections;
  }
}

export function squashDetections(packageGraph: PackageGraph<PointOfInterest[]>):
    Map<string, number> {
  const sortedDataArray = packageGraph.data.slice(0).sort(compare);
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
