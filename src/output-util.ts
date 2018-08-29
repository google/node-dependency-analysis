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
