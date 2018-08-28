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

/* TODO: 1. Add more TestProjects and test them
         2. Test methods that convert PackageTree<string> to
             PackageTree<PointOfInterest[]>
*/
import test from 'ava';
import path from 'path';

import * as tree from '../src/package-tree';
import {generatePackageTree, PackageTree} from '../src/package-tree';

import {testCases} from './mock-projects';
import * as util from './util';

test(
    'the data property of the package tree should changed from undefined ' +
        'to an array of Points of Interest',
    async t => {
      // See how the dependency graph looks in test-projects
      const testProject = new util.TestProject(testCases.test1);
      const testPath: string = await testProject.create();

      const c1 = {name: 'c', version: '1.0.0', data: null, dependencies: []};
      const c2 = {name: 'c', version: '2.0.0', data: null, dependencies: []};
      const b1 = {name: 'b', version: '1.0.0', data: null, dependencies: [c1]};
      const a1 =
          {name: 'a', version: '1.0.0', data: null, dependencies: [b1, c1]};
      const root: PackageTree =
          {name: 'root', version: '1.0.0', data: null, dependencies: [a1, c2]};

      const resolvedTree: PackageTree<string> =
          await tree.resolvePaths(root, testPath);

      const rootDependencies = resolvedTree.dependencies.sort(sortByName);
      const a1Pjson =
          require(path.join(rootDependencies[0].data, 'package.json'));
      t.deepEqual(a1Pjson.name, 'a');
      t.deepEqual(a1Pjson.version, '1.0.0');
      const c2Pjson =
          require(path.join(rootDependencies[1].data, 'package.json'));
      t.deepEqual(c2Pjson.name, 'c');
      t.deepEqual(c2Pjson.version, '2.0.0');

      const a1Dependencies = rootDependencies[0].dependencies.sort(sortByName);
      const b1Pjson =
          require(path.join(a1Dependencies[0].data, 'package.json'));
      t.deepEqual(b1Pjson.name, 'b');
      t.deepEqual(b1Pjson.version, '1.0.0');
      const c1Pjson1 =
          require(path.join(a1Dependencies[1].data, 'package.json'));
      t.deepEqual(c1Pjson1.name, 'c');
      t.deepEqual(c1Pjson1.version, '1.0.0');

      const b1Dependencies = a1Dependencies[0].dependencies.sort(sortByName);
      const c1Pjson2 =
          require(path.join(b1Dependencies[0].data, 'package.json'));
      t.deepEqual(c1Pjson2.name, c1Pjson2.name);
      t.deepEqual(c1Pjson2.version, c1Pjson2.version);

      testProject.cleanup();
    });

/* TODO: test2
test('', async t => {
  // See how the dependency graph looks in test-projects
  const testPath: string = await tests.test2.create();
  tests.test2.cleanup();
});*/

function sortByName(a: PackageTree<string>, b: PackageTree<string>) {
  if (a.name < b.name) {
    return -1;
  } else {
    return 1;
  }
}



test(
    'generatePackageTree should return a populated PackageTree given a project name and its root directory',
    async t => {
      const mockProjectKeys = Object.keys(testCases);
      for (const mockProjectKey of mockProjectKeys) {
        const testResultObj = await testFunctionCreator(mockProjectKey);
        t.deepEqual(testResultObj.actualResult, testResultObj.expectedResult);
      }
    });

test(
    'generatePackageTree throws an error if it can not find a file',
    async t => {
      const fakeReadFilep = () => {
        throw new Error('File Not Found');
      };

      await t.throws(
          generatePackageTree('.', fakeReadFilep), Error, 'File Not Found');
    });

test(
    'generatePackageTree does not create duplicates of the same module when multiple modules depend on it',
    async t => {
      const testProject = new util.TestProject(testCases.test3);
      const testPath = await testProject.create();
      const packageTreeResult = await generatePackageTree(testPath);
      t.true(
          packageTreeResult.dependencies[0].dependencies[0] ===
          packageTreeResult.dependencies[1].dependencies[0]);
      testProject.cleanup();
    });

/**
 * Generates a PackageTree given a TestProject object
 * @param testProjectObj the object passed to the TestProject constructor
 */
function generateExpectedTree(testProjectObj: util.DependencyGraph):
    PackageTree<null> {
  const keys = Object.keys(testProjectObj).sort();
  const createdPackageTrees = new Map<string, PackageTree>();
  const treeHead =
      {name: 'test-project', version: '0.0.0', data: null, dependencies: []};
  createdPackageTrees.set('*', treeHead);

  // Skip the root, because it was added above
  for (let keyIndex = 1; keyIndex < keys.length; keyIndex++) {
    const nvt = util.NVT.parse(keys[keyIndex]);
    const pkgT = {
      name: nvt.name,
      version: `file:${keys[keyIndex]}`,
      data: null,
      dependencies: []
    };
    createdPackageTrees.set(keys[keyIndex], pkgT);
  }
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const currentPackageTree = createdPackageTrees.get(keys[keyIndex]);
    if (currentPackageTree) {
      const dependencies = testProjectObj[keys[keyIndex]];
      dependencies.forEach(element => {
        if (!createdPackageTrees.has(element)) {
          throw new Error(
              `Dependency ${element} is not present in this test project.`);
        }
        currentPackageTree.dependencies.push(createdPackageTrees.get(element)!);
      });
    }
  }
  return treeHead;
}

/**
 * Takes in the name of a testProject in mock-projects and returns an object
 * with populated fields corresponding to important test data
 * @param testProjectName
 */
async function testFunctionCreator(testProjectName: string):
    Promise<TestResults> {
  const testGraph = testCases[testProjectName];
  const testProject = new util.TestProject(testGraph);
  const testProjectPath = await testProject.create();
  const actualResult = await generatePackageTree(testProjectPath);
  const expectedResult = generateExpectedTree(testGraph);
  testProject.cleanup();
  return {
    testGraph,
    testProject,
    testProjectPath,
    actualResult,
    expectedResult
  };
}

/**
 * testGraph: The dependency graph used for this test
 * testProject: The TestProject object created for this test
 * testProjectPath: The path to the root of the TestProject created
 * actualResult: A PackageTree generated from generatePackageTree
 * expectedResult: A PackageTree generated from generateExpectedPackageTree
 */
interface TestResults {
  testGraph: util.DependencyGraph;
  testProject: util.TestProject;
  testProjectPath: string;
  actualResult: tree.PackageTree<null>;
  expectedResult: tree.PackageTree<null>;
}
