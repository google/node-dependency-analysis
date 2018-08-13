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
import {generatePackageTree, getPackageTreeFromDependencyList, PackageTree} from '../src/package-tree';

import * as tests from './mock-projects';

test(
    'the data property of the package tree should changed from undefined ' +
        'to an array of Points of Interest',
    async t => {
      // See how the dependency graph looks in test-projects
      const testPath: string = await tests.test1.create();

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

      tests.test1.cleanup();
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
    'getPackageTreeFromDependencyList should return a PackageTree array',
    async t => {
      const dependencies = {module1: 'version1', module2: 'version2'};
      const packageLock = {
        dependencies: {
          module1: {requires: {module5: 'version5'}},
          module2: {requires: {module6: 'version6'}},
          module3: {requires: {module4: 'version4'}},
          module4: {},
          module5: {},
          module6: {}
        }
      };
      const result =
          await getPackageTreeFromDependencyList(dependencies, packageLock);
      const expectedResult = [
        {
          name: 'module1',
          version: 'version1',
          data: null,
          dependencies: [{
            name: 'module5',
            version: 'version5',
            data: null,
            dependencies: []
          }]
        },

        {
          name: 'module2',
          version: 'version2',
          data: null,
          dependencies: [{
            name: 'module6',
            version: 'version6',
            data: null,
            dependencies: []
          }]
        }
      ];
      t.deepEqual(result, expectedResult);
    });

test(
    'generatePackageTree should return a populated PackageTree given a project name and its root directory',
    async t => {
      const pkgJson = {
        name: 'testProject',
        version: '1.0.0',
        dependencies: {
          module1: 'version1',
        },
        devDependencies: {module2: 'version2'}
      };
      const packageLock = {
        dependencies: {
          module1: {requires: {module5: 'version5'}},
          module2: {requires: {module6: 'version6'}},
          module3: {requires: {module4: 'version4'}},
          module4: {},
          module5: {},
          module6: {}
        }
      };
      async function fakeReadFilep(filepath: string): Promise<string> {
        if (filepath === 'package.json') {
          return JSON.stringify(pkgJson);
        }
        if (filepath === 'package-lock.json') {
          return JSON.stringify(packageLock);
        }
        throw new Error('File Not Found');
      }
      const result = await generatePackageTree('.', fakeReadFilep);
      const expectedResult = {
        name: 'testProject',
        version: '1.0.0',
        data: null,
        dependencies: [
          {
            name: 'module1',
            version: 'version1',
            data: null,
            dependencies: [{
              name: 'module5',
              version: 'version5',
              data: null,
              dependencies: []
            }]
          },

          {
            name: 'module2',
            version: 'version2',
            data: null,
            dependencies: [{
              name: 'module6',
              version: 'version6',
              data: null,
              dependencies: []
            }]
          }
        ]
      };
      t.deepEqual(result, expectedResult);
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
