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

import * as graph from '../src/package-graph';
import {generatePackageGraph, PackageGraph} from '../src/package-graph';

import {testCases} from './mock-projects';
import * as util from './util';

test(
    'the data property of the package graph should ' +
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
      const root: graph.PackageGraph =
          {name: 'root', version: '1.0.0', data: null, dependencies: [a1, c2]};

      const resolvedGraph: graph.PackageGraph<string> =
          await graph.resolvePaths(root, testPath);

      checkPjsons(resolvedGraph, t, testCases.project1);

      testProject.cleanup();
    });

test(
    'the data property of the package graph should ' +
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
      const resolvedGraph: graph.PackageGraph<string> =
          await graph.resolvePaths(root, testPath);
      checkPjsons(resolvedGraph, t, testCases.project2);

      test.cleanup();
    });

test(
    'the data property of the package graph should ' +
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

      const resolvedGraph: graph.PackageGraph<string> =
          await graph.resolvePaths(root, testPath);
      checkPjsons(resolvedGraph, t, testCases.project3);
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
      const a1Files = await graph.getJSFiles(a1Dir);
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
      const b1Files = await graph.getJSFiles(b1Dir);
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
    'the package graph should be populated with Points of Interest',
    async t => {
      const test = new util.TestProject(testCases.project5);
      test.addFile('a@1', './file1.js', 'const r = require;\n');
      test.addFile('a@1', './file2.js', 'const h = require("http");');
      const testPath: string = await test.create();
      const p = path.join(testPath, 'a@1');
      const n = {name: 'a', version: '1.0.0', data: p, dependencies: []};
      const updatedA1Node = await graph.populatePOIInPackageGraph(n);
      t.deepEqual(updatedA1Node.data.length, 2);
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'Obfuscated require identifier' &&
            pkg.fileName === path.join(p, 'file1.js');
      }));
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'http' && pkg.fileName === path.join(p, 'file2.js');
      }));
      test.cleanup();
    });

test(
    'graph' +
        'file if there is a syntax error',
    async t => {
      const test = new util.TestProject(testCases.project5);
      test.addFile('a@1', './file1.js', 'const r = require;\n const s = "');
      test.addFile('a@1', './file2.js', 'const net = require("net");');
      const testPath: string = await test.create();
      const a1Path = path.join(testPath, 'a@1');
      const a1Node =
          {name: 'a', version: '1.0.0', data: a1Path, dependencies: []};
      const updatedA1Node = await graph.populatePOIInPackageGraph(a1Node);
      t.deepEqual(updatedA1Node.data.length, 2);
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'Syntax Error' &&
            pkg.fileName === path.join(a1Path, 'file1.js');
      }));
      t.false(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'Obfuscated require identifier' &&
            pkg.fileName === path.join(a1Path, 'file1.js');
      }));
      t.true(updatedA1Node.data.some((pkg) => {
        return pkg.type === 'net' &&
            pkg.fileName === path.join(a1Path, 'file2.js');
      }));
      test.cleanup();
    });

test('generatePackageGraph', async t => {
  const fakeReadFilep = () => {
    throw new Error('File Not Found');
  };

  await t.throws(
      graph.generatePackageGraph('.', fakeReadFilep), Error, 'File Not Found');
});

test(
    'end-to-end: should generate a package graph with points of interest',
    async t => {
      const test = new util.TestProject(testCases.project1);
      test.addFile('a@1', './a1File1.js', 'const r = require;\n const s = "');
      test.addFile('a@1', './a1File2.js', 'const net = require("net");');
      test.addFile('c@2', './c2File1.js', 'console.log("this file is ok");');
      test.addFile('c@1', './c1File1.js', 'console.log("this file is ok")');
      test.addFile('c@1', './c1File2.js', 'const r = require("fs")');
      const testPath = await test.create();
      const emptyPackageGraph = await graph.generatePackageGraph(testPath);
      const packageGraphWithPath =
          await graph.resolvePaths(emptyPackageGraph, testPath);
      const packageGraphWithPOI =
          await graph.populatePOIInPackageGraph(packageGraphWithPath);

      // a@1 tests
      const a1Package = packageGraphWithPOI.dependencies.filter((dep) => {
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
      const c2Folder = packageGraphWithPOI.dependencies.filter((dep) => {
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
      const b1Package = packageGraphWithPOI.dependencies.filter((dep) => {
        return dep.name === 'b' && dep.version === 'file:b@1';
      });
      t.deepEqual(b1Package[0].dependencies.length, 1);
      const b1Data = b1Package[0].data;
      t.deepEqual(b1Data.length, 0);

      test.cleanup();
    });

test(
    'generatePackageGraph should return a populated PackageGraph given a ' +
        'project name and its root directory',
    async t => {
      const mockProjectKeys = Object.keys(testCases);
      for (const mockProjectKey of mockProjectKeys) {
        const testResultObj = await testFunctionCreator(mockProjectKey);
        t.deepEqual(testResultObj.actualResult, testResultObj.expectedResult);
      }
    });

test(
    'generatePackageGraph does not create duplicates of the same module ' +
        'when multiple modules depend on it',
    async t => {
      const testProject = new util.TestProject(testCases.project7);
      const testPath = await testProject.create();
      const packageGraphResult = await generatePackageGraph(testPath);
      t.true(
          packageGraphResult.dependencies[0].dependencies[0] ===
          packageGraphResult.dependencies[1].dependencies[0]);
      testProject.cleanup();
    });

/**
 * Generates a PackageGraph given a TestProject object
 * @param testProjectObj the object passed to the TestProject constructor
 */
function generateExpectedGraph(testProjectObj: util.DependencyGraph):
    PackageGraph<null> {
  const keys = Object.keys(testProjectObj).sort();
  const createdPackageGraphs = new Map<string, PackageGraph>();
  const graphHead =
      {name: 'test-project', version: '0.0.0', data: null, dependencies: []};
  createdPackageGraphs.set('*', graphHead);

  // Skip the root, because it was added above
  for (let keyIndex = 1; keyIndex < keys.length; keyIndex++) {
    const nvt = util.NVT.parse(keys[keyIndex]);
    const pkgT = {
      name: nvt.name,
      version: `file:${keys[keyIndex]}`,
      data: null,
      dependencies: []
    };
    createdPackageGraphs.set(keys[keyIndex], pkgT);
  }
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const currentPackageGraph = createdPackageGraphs.get(keys[keyIndex]);
    if (currentPackageGraph) {
      const dependencies = testProjectObj[keys[keyIndex]];
      dependencies.forEach(element => {
        if (!createdPackageGraphs.has(element)) {
          throw new Error(
              `Dependency ${element} is not present in this test project.`);
        }
        currentPackageGraph.dependencies.push(createdPackageGraphs.get(element)!
        );
      });
    }
  }
  return graphHead;
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
  const actualResult = await generatePackageGraph(testProjectPath);
  const expectedResult = generateExpectedGraph(testGraph);
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
 * actualResult: A PackageGraph generated from generatePackageGraph
 * expectedResult: A PackageGraph generated from generateExpectedPackageGraph
 */
interface TestResults {
  testGraph: util.DependencyGraph;
  testProject: util.TestProject;
  testProjectPath: string;
  actualResult: graph.PackageGraph<null>;
  expectedResult: graph.PackageGraph<null>;
}

/**
 * Recursive function that creates a map of packages where the key is the
 * name and version, and the value is the corresponding package graph
 *
 * @param pkg the current package graph
 * @param map the map holding resolved packages
 */
function createPackageMap(
    pkg: graph.PackageGraph<string>,
    map: Map<string, graph.PackageGraph<string>>) {
  pkg.dependencies.forEach((p) => {
    createPackageMap(p, map);
  });
  map.set(`${pkg.name}@${pkg.version}`, pkg);
  return map;
}

/**
 * Checks that all nodes in a package graph hold the correct path
 *
 * @param pkg the root of the package graph
 * @param t the object used for tests
 * @param project an object that lists package dependents and dependencies
 */
function checkPjsons<T>(
    pkg: graph.PackageGraph<string>, t: GenericTestContext<T>,
    project: util.DependencyGraph) {
  let map = new Map<string, graph.PackageGraph<string>>();
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
