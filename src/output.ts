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
import semver from 'semver';

import {getNumberOfTransitiveDetections, squashDetections} from './output-util';
import {PackageGraph, PointOfInterest} from './package-graph';

// File to output to user
export function outputToUser(
    packageGraph: PackageGraph<PointOfInterest[]>, verbose = false) {
  const sortedModules =
      flattenPackageGraph(
          packageGraph, new Map<string, PackageGraph<PointOfInterest[]>>())
          .sort(compare);

  console.log(output(sortedModules, verbose));
}

function flattenPackageGraph(
    packageGraph: PackageGraph<PointOfInterest[]>,
    flattenedGraphs: Map<string, PackageGraph<PointOfInterest[]>>):
    Array<PackageGraph<PointOfInterest[]>> {
  const combined: Array<PackageGraph<PointOfInterest[]>> = [];
  // Check to make sure that this packageGraph has not already been added
  if (!flattenedGraphs.has(`${packageGraph.name} ${packageGraph.version}`)) {
    combined.push(packageGraph);
    flattenedGraphs.set(
        `${packageGraph.name} ${packageGraph.version}`, packageGraph);
    packageGraph.dependencies.forEach((dep) => {
      combined.push(...flattenPackageGraph(dep, flattenedGraphs));
    });
  }
  return combined;
}

function output(
    packageGraphs: Array<PackageGraph<PointOfInterest[]>>,
    verbose: boolean): string {
  const arrOfStrings: string[] = [];
  packageGraphs.forEach((packageGraph) => {
    arrOfStrings.push(
        `${packageGraph.name} ${packageGraph.version} Detections: ${
            packageGraph.data.length} Immediate ${
            getNumberOfTransitiveDetections(packageGraph)} Transitive`);
    if (verbose) {
      packageGraph.data.forEach((dataPoint) => {
        arrOfStrings.push(getColorFromType(
            dataPoint.type,
            `     ${dataPoint.type} found in ${
                dataPoint.fileName.split(
                    'node_modules/')[1]}:${dataPoint.position.lineStart}`));
      });
    } else {
      if (packageGraph.data.length > 0) {
        arrOfStrings.push(`  Detected Patterns:`);
        const squashedDetections = squashDetections(packageGraph);
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

    packageGraph.dependencies.forEach((dep) => {
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
    a: PackageGraph<PointOfInterest[]>,
    b: PackageGraph<PointOfInterest[]>): number {
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
  'requiredModule-http': 2,
  'requiredModule-http2': 2,
  'requiredModule-fs': 2,
  'requiredModule-https': 2,
  'requiredModule-net': 2,
  'requiredModule-dgram': 2,
  'requiredModule-child_process': 2,
  'requiredModule-repl': 3,
  'requiredModule-vm': 3,
  'requiredModule-module': 3,
  'unprocessed-syntaxError': 1,
  'dynamicArgument-require': 3,
  'valueReassignment-require': 3,
  'functionCall-eval': 3,
  'valueReassignment-eval': 3,
  'propertyAccess-eval': 3,
  'specificPropertyAccess-process.env': 2,
  'obfuscatedProperty-process': 3,
  'valueReassignment-process': 2,
  'propertyAccess-Function': 3,
  'functionCall-Function': 3,
  'valueReassignment-Function': 3,
  'specificPropertyAccess-global.eval': 3,
  'specificPropertyAccess-global.require': 3,
  'specificPropertyAccess-global.Function': 3,
  'valueReassignment-global': 2,
  'dynamicProperty-global': 3
};
