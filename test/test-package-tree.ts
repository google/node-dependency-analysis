/* TODO: 1. Add more TestProjects and test them
         2. Test methods that convert PackageTree<string> to
             PackageTree<PointOfInterest[]>
*/
import test from 'ava';
import path from 'path';

import * as tree from '../src/package-tree';
import {PackageTree} from '../src/package-tree';

import * as tests from './mock-projects';

test(
    'the data property of the package tree should changed from null ' +
        'to an array of Points of Interest',
    async t => {
      // See how the dependency graph looks in test-projects
      const testPath: string = await tests.test1.create();

      const c1 = {name: 'c', version: '1.0.0', data: null, dependencies: []};
      const c2 = {name: 'c', version: '2.0.0', data: null, dependencies: []};
      const b1 = {name: 'b', version: '1.0.0', data: null, dependencies: [c1]};
      const a1 =
          {name: 'a', version: '1.0.0', data: null, dependencies: [b1, c1]};
      const root =
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
