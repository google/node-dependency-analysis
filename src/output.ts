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

import {PackageTree, PointOfInterest} from './package-tree';

// File to output to user
export function outputToUser(packageTree: PackageTree<PointOfInterest[]>) {
  const sortedModules = flattenPackageTree(packageTree).sort(compare);
  console.log(output(sortedModules));
}

function flattenPackageTree(packageTree: PackageTree<PointOfInterest[]>):
    Array<PackageTree<PointOfInterest[]>> {
  const combined: Array<PackageTree<PointOfInterest[]>> = [];
  combined.push(packageTree);
  packageTree.dependencies.forEach((dep) => {
    combined.push(...flattenPackageTree(dep));
  });
  return combined;
}

function output(packageTrees: Array<PackageTree<PointOfInterest[]>>): string {
  const arrOfStrings: string[] = [];
  packageTrees.forEach((packageTree) => {
    arrOfStrings.push(
        `Name: ${packageTree.name}, Version: ${packageTree.version}`);

    if (packageTree.data.length > 0) {
      arrOfStrings.push(`  Detected Patterns:`);
    }

    packageTree.data.forEach((data) => {
      arrOfStrings.push(`     Type: ${data.type}, Location: ${data.fileName}:${
          data.position.lineStart}`);
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
