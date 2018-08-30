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

import semver from 'semver';

import {getNumberOfTransitiveDetections, squashDetections} from './output-util';
import {PackageTree, PointOfInterest} from './package-tree';

// File to output to user
export function outputToUser(packageTree: PackageTree<PointOfInterest[]>) {
  const sortedModules =
      flattenPackageTree(
          packageTree, new Map<string, PackageTree<PointOfInterest[]>>())
          .sort(compare);
  console.log(output(sortedModules));
}

function flattenPackageTree(
    packageTree: PackageTree<PointOfInterest[]>,
    flattenedTrees: Map<string, PackageTree<PointOfInterest[]>>):
    Array<PackageTree<PointOfInterest[]>> {
  const combined: Array<PackageTree<PointOfInterest[]>> = [];
  // Check to make sure that this packageTree has not already been added
  if (!flattenedTrees.has(`${packageTree.name} ${packageTree.version}`)) {
    combined.push(packageTree);
    flattenedTrees.set(
        `${packageTree.name} ${packageTree.version}`, packageTree);
    packageTree.dependencies.forEach((dep) => {
      combined.push(...flattenPackageTree(dep, flattenedTrees));
    });
  }
  return combined;
}

function output(packageTrees: Array<PackageTree<PointOfInterest[]>>): string {
  const arrOfStrings: string[] = [];
  packageTrees.forEach((packageTree) => {
    arrOfStrings.push(`${packageTree.name} ${packageTree.version} Detections: ${
        packageTree.data.length} Immediate ${
        getNumberOfTransitiveDetections(
            packageTree,
            new Map<string, PackageTree<PointOfInterest[]>>())} Transitive`);

    if (packageTree.data.length > 0) {
      arrOfStrings.push(`  Detected Patterns:`);
      const squashedDetections = squashDetections(packageTree);
      for (const type of squashedDetections) {
        if (type[1] > 1) {
          arrOfStrings.push(`     ${type[1]} instances of '${type[0]}'`);
        } else {
          arrOfStrings.push(`     ${type[0]}`);
        }
      }
    }


    if (packageTree.dependencies.length > 0) {
      arrOfStrings.push(`  Dependencies:`);
    }


    packageTree.dependencies.forEach((dep) => {
      if (dep.data.length > 0) {
        arrOfStrings.push(
            `     ${dep.name} ${dep.version} Detections: ${dep.data.length}`);
      }
    });
  });

  return arrOfStrings.join('\n');
}

/**
 * Compare function for packages
 *
 * @param a 1st package
 * @param b 2nd package
 */
function compare(
    a: PackageTree<PointOfInterest[]>,
    b: PackageTree<PointOfInterest[]>): number {
  if (a.name < b.name) {
    return -1;
  }
  if (a.name > b.name) {
    return 1;
  }
  if (semver.valid(a.version) && semver.valid(b.version)) {
    return semver.compare(a.version, b.version);
  } else {
    return a.version.localeCompare(b.version);
  }
}
