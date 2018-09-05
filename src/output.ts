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

import chalk from 'chalk';
import * as path from 'path';
import semver from 'semver';

import {getNumberOfTransitiveDetections, squashDetections} from './output-util';
import {PackageTree, PointOfInterest} from './package-tree';

// File to output to user
export function outputToUser(
    packageTree: PackageTree<PointOfInterest[]>, verbose = false) {
  const sortedModules =
      flattenPackageTree(
          packageTree, new Map<string, PackageTree<PointOfInterest[]>>())
          .sort(compare);

  console.log(output(sortedModules, verbose));
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

function output(
    packageTrees: Array<PackageTree<PointOfInterest[]>>,
    verbose: boolean): string {
  const arrOfStrings: string[] = [];
  packageTrees.forEach((packageTree) => {
    arrOfStrings.push(`${packageTree.name} ${packageTree.version} Detections: ${
        packageTree.data.length} Immediate ${
        getNumberOfTransitiveDetections(packageTree)} Transitive`);
    if (verbose) {
      packageTree.data.forEach((dataPoint) => {
        arrOfStrings.push(getColorFromType(
            dataPoint.type,
            `     ${dataPoint.type} found in ${
                dataPoint.fileName.split('node_modules/')[1]} at ${
                JSON.stringify(dataPoint.position, null, 1)}`));
      });
    } else {
      if (packageTree.data.length > 0) {
        arrOfStrings.push(`  Detected Patterns:`);
        const squashedDetections = squashDetections(packageTree);
        for (const type of squashedDetections) {
          if (type[1] > 1) {
            arrOfStrings.push(getColorFromType(
                type[0], `     ${type[1]} instances of '${type[0]}'`));
          } else {
            arrOfStrings.push(getColorFromType(type[0], `     ${type[0]}`));
          }
        }
      }
    }
    // only display modules that have immediate or transitive dependencies in
    // dependencies field to save space
    let dependencyFound = false;

    packageTree.dependencies.forEach((dep) => {
      if (dep.data.length > 0 || getNumberOfTransitiveDetections(dep) > 0) {
        if (!dependencyFound) {
          arrOfStrings.push(`  Dependencies:`);
          dependencyFound = true;
        }
        arrOfStrings.push(`     ${dep.name} ${dep.version} Detections: ${
            dep.data.length} Immediate ${
            getNumberOfTransitiveDetections(dep)} Transitive`);
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

function getColorFromType(type: string, detectionString: string): string {
  const severity = typeTable[type];
  switch (severity) {
    case 1:
      return chalk.greenBright(detectionString);
    case 2:
      return chalk.yellowBright(detectionString);
    case 3:
      return chalk.redBright(detectionString);
    default:
      return detectionString;
  }
}

// Maps each type to a severity value which is translated to a color for the
// output in getColorFromType
const typeTable: {[type: string]: number} = {
  'http': 2,
  'http2': 2,
  'fs': 2,
  'https': 2,
  'net': 2,
  'datagram': 2,
  'child_process': 2,
  'repl': 3,
  'vm': 3,
  'module': 3,
  'Syntax Error': 1,
  'Dynamic Require Arg': 3,
  'Obfuscated require identifier': 3,
  'Eval Call': 3,
  'Obfuscated eval identifier': 3,
  'Access to a property of eval': 3,
  'Access to process.env': 2,
  'Obscured process property': 3,
  'Obfuscated process identifier': 3,
  'Obscured process object': 3,
  'Dynamic Require Call': 3
};
