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
import test, {GenericTestContext} from 'ava';
import path from 'path';

import * as tree from '../src/package-tree';
import {generatePackageTree, PackageTree} from '../src/package-tree';

import {testCases} from './mock-projects';
import * as util from './util';

test(
    'the data property of the package tree should ' +
        'get the correct path to the package (test 1/3)',
    async t => {
      // See how the dependency graph looks in test-projects
      const testProject = new util.TestProject(testCases.project1);
      const testPath: string = await testProject.create();

      const c1 = {name: 'c', version: '1.0.0', data: null, dependencies: []};
      const c2 = {name: 'c', version: '2.0.0', data: null, dependencies: []};
      const b1 = {name: 'b', version: '1.0.0', data: null, dependencies: [c1]};
      const a1 =
          {name: 'a', version: '1.0.0', data: null, dependencies: [b1, c1]};
      const root: tree.PackageTree =
          {name: 'root', version: '1.0.0', data: null, dependencies: [a1, c2]};

      const resolvedTree: tree.PackageTree<string> =
          await tree.resolvePaths(root, testPath);

      checkPjsons(resolvedTree, t, testCases.project1);

      testProject.cleanup();
    });

test(
    'the data property of the package tree should ' +
        'get the correct path to the package (test 2/3)',
    async t => {
      const test = new util.TestProject(testCases.project2);
      const testPath: string = await test.create();
      const d1 = {name: 'd', version: '1.0.0', data: null, dependencies: []};
      const c1 = {name: 'c', version: '1.0.0', data: null, dependencies: [d1]};
      const b1 = {name: 'b', version: '1.0.0', data: null, dependencies: [c1]};
      const a1 = {name: 'a', version: '1.0.0', data: null, dependencies: [c1]};
      const root =
          {name: 'root', version: '1.0.0', data: null, dependencies: [a1, b1]};
      const resolvedTree: tree.PackageTree<string> =
          await tree.resolvePaths(root, testPath);
      checkPjsons(resolvedTree, t, testCases.project2);

      test.cleanup();
    });

test(
    'the data property of the package tree should ' +
        'get the correct path to the package (test 3/3)',
    async t => {
      const test = new util.TestProject(testCases.project3);
      const testPath: string = await test.create();
      const d1 = {name: 'd', version: '1.0.0', data: null, dependencies: []};
      const c1 = {name: 'c', version: '1.0.0', data: null, dependencies: [d1]};
      const b1 = {name: 'b', version: '1.0.0', data: null, dependencies: [c1]};
      const a1 = {name: 'a', version: '1.0.0', data: null, dependencies: [b1]};
      const root =
          {name: 'root', version: '1.0.0', data: null, dependencies: [a1]};

      const resolvedTree: tree.PackageTree<string> =
          await tree.resolvePaths(root, testPath);
      checkPjsons(resolvedTree, t, testCases.project3);
      test.cleanup();
    });

test(
    'getJSFiles should not get files in a project\'s dependencies', async t => {
      const test = new util.TestProject(testCases.project4);
      test.addFile('b@1', './src/src2/index.js', 'console.log()');
      test.addFile('b@1', './util.ts', 'console.log()');
      test.addFile('b@1', './build/cli.js', 'console.log()');
      const testPath: string = await test.create();
      const a1Dir = path.join(testPath, 'a@1');
      const a1Files = await tree.getJSFiles(a1Dir);
      t.false(
          a1Files.includes(path.join('node_modules', 'b@1/src/src2/index.js')));
      test.cleanup();
    });

test(
    'getJSFiles should get only JS files (not directories) in its directory ',
    async t => {
      const test = new util.TestProject(testCases.project4);
      test.addFile('b@1', './src/src2/index.js', 'console.log()');
      test.addFile('b@1', './util.ts', 'console.log()');
      test.addFile('b@1', './build/cli.js', 'console.log()');
      const testPath: string = await test.create();
      const b1Dir = path.join(testPath, 'b@1');
      const b1Files = await tree.getJSFiles(b1Dir);
      t.true(b1Files.includes(path.join(b1Dir, 'src/src2/index.js')));
      t.true(b1Files.includes(path.join(b1Dir, 'build/cli.js')));
      t.false(b1Files.includes(path.join(b1Dir, 'util.ts')));
      t.false(b1Files.includes(path.join(b1Dir, 'package.json')));
      t.false(b1Files.includes(path.join(b1Dir, 'node_modules')));
      t.false(b1Files.includes(path.join(b1Dir, 'src')));
      t.false(b1Files.includes(path.join(b1Dir, 'src/src2')));
      t.false(b1Files.includes(path.join(b1Dir, 'build')));
      test.cleanup();
    });

test(
    'the package tree should be populated with Points of Interest', async t => {
      const test = new util.TestProject(testCases.project5);
      test.addFile('a@1', './file1.js', 'const r = require;\n');
      test.addFile('a@1', './file2.js', 'const h = require(\'http\');');
      const testPath: string = await test.create();
      const p = path.join(testPath, 'a@1');
      const n = {name: 'a', version: '1.0.0', data: p, dependencies: []};
      const updatedA1Node = await tree.populatePOIInPackageTree(n);
      t.deepEqual(updatedA1Node.data.length, 2);
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'Dynamic Require Call' &&
            pkg.fileName === path.join(p, 'file1.js');
      }));
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'http' && pkg.fileName === path.join(p, 'file2.js');
      }));
      test.cleanup();
    });

test(
    'the package tree should return only a syntax poi for a ' +
        'file if there is a syntax error',
    async t => {
      const test = new util.TestProject(testCases.project5);
      test.addFile('a@1', './file1.js', 'const r = require;\n const s = \'');
      test.addFile('a@1', './file2.js', 'const net = require(\'net\');');
      const testPath: string = await test.create();
      const a1Path = path.join(testPath, 'a@1');
      const a1Node =
          {name: 'a', version: '1.0.0', data: a1Path, dependencies: []};
      const updatedA1Node = await tree.populatePOIInPackageTree(a1Node);
      t.deepEqual(updatedA1Node.data.length, 2);
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'Syntax Error' &&
            pkg.fileName === path.join(a1Path, 'file1.js');
      }));
      t.false(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'Dynamic Require Call' &&
            pkg.fileName === path.join(a1Path, 'file1.js');
      }));
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'net' &&
            pkg.fileName === path.join(a1Path, 'file2.js');
      }));
      test.cleanup();
    });

test(
    'generatePackageTree throws an error if it can not find a file',
    async t => {
      const fakeReadFilep = () => {
        throw new Error('File Not Found');
      };

      await t.throws(
          tree.generatePackageTree('.', fakeReadFilep), Error,
          'File Not Found');
    });

test(
    'end-to-end: should generate a package tree with points of interest',
    async t => {
      const test = new util.TestProject(testCases.project1);
      test.addFile('a@1', './a1File1.js', 'const r = require;\n const s = \'');
      test.addFile('a@1', './a1File2.js', 'const net = require(\'net\');');
      test.addFile('c@2', './c2File1.js', 'console.log(\'this file is ok\');');
      test.addFile('c@1', './c1File1.js', 'console.log(\'this file is ok\')');
      test.addFile('c@1', './c1File2.js', 'const r = require(\'fs\')');
      const testPath = await test.create();
      const emptyPackageTree = await tree.generatePackageTree(testPath);
      const packageTreeWithPath =
          await tree.resolvePaths(emptyPackageTree, testPath);
      const packageTreeWithPOI =
          await tree.populatePOIInPackageTree(packageTreeWithPath);

      // a@1 tests
      const a1Package = packageTreeWithPOI.dependencies.filter((dep) => {
        return dep.name === 'a' && dep.version === 'file:a@1';
      });
      t.deepEqual(a1Package[0].dependencies.length, 1);
      const a1Data = a1Package[0].data;
      t.deepEqual(a1Data.length, 2);
      t.true(a1Data.some((pkg) => {
        return pkg.type === 'Syntax Error' &&
            pkg.fileName === path.join(testPath, 'node_modules/a/a1File1.js');
      }));
      t.true(a1Data.some((pkg) => {
        return pkg.type === 'net' &&
            pkg.fileName === path.join(testPath, 'node_modules/a/a1File2.js');
      }));

      // c@2 tests
      const c2Folder = packageTreeWithPOI.dependencies.filter((dep) => {
        return dep.name === 'c' && dep.version === 'file:c@2';
      });
      t.deepEqual(c2Folder[0].dependencies.length, 0);
      const c2Data = c2Folder[0].data;
      t.deepEqual(c2Data.length, 0);

      // c@1 tests
      const c1Package = a1Package[0].dependencies.filter((dep) => {
        return dep.name === 'c' && dep.version === 'file:c@1';
      });
      t.deepEqual(c1Package[0].dependencies.length, 0);
      const c1Data = c1Package[0].data;
      t.deepEqual(c1Data.length, 1);
      t.true(c1Data.some((pkg) => {
        return pkg.type === 'fs' &&
            pkg.fileName ===
            path.join(testPath, 'node_modules/a/node_modules/c/c1File2.js');
      }));

      // b@1 tests
      const b1Package = packageTreeWithPOI.dependencies.filter((dep) => {
        return dep.name === 'b' && dep.version === 'file:b@1';
      });
      t.deepEqual(b1Package[0].dependencies.length, 1);
      const b1Data = b1Package[0].data;
      t.deepEqual(b1Data.length, 0);

      test.cleanup();
    });

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
    'generatePackageTree does not create duplicates of the same module when multiple modules depend on it',
    async t => {
      const testProject = new util.TestProject(testCases.project7);
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

/**
 * Recursive function that creates a map of packages where the key is the
 * name and version, and the value is the corresponding package tree
 *
 * @param pkg the current package tree
 * @param map the map holding resolved packages
 */
function createPackageMap(
    pkg: tree.PackageTree<string>, map: Map<string, tree.PackageTree<string>>) {
  pkg.dependencies.forEach((p) => {
    createPackageMap(p, map);
  });
  map.set(`${pkg.name}@${pkg.version}`, pkg);
  return map;
}

/**
 * Checks that all nodes in a package tree hold the correct path
 *
 * @param pkg the root of the package tree
 * @param t the object used for tests
 * @param project an object that lists package dependents and dependencies
 */
function checkPjsons<T>(
    pkg: tree.PackageTree<string>, t: GenericTestContext<T>,
    project: util.DependencyGraph) {
  let map = new Map<string, tree.PackageTree<string>>();
  map = createPackageMap(pkg, map);

  for (const key in project) {
    if (key !== '*') {
      const pkg = map.get(`${key}.0.0`);
      t.notDeepEqual(pkg, undefined);
      const pjson = require(path.join(pkg!.data, 'package.json'));
      t.deepEqual(`${pjson.name}@${pjson.version}`, `${key}.0.0`);
    }
  }
}
