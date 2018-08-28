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

import * as util from './util';
//         *
//     /   |   \
//   a@1  b@1  c@2
//    /    \
//   c@1   c@1
const test1 = ({
  '*': ['a@1', 'c@2', 'b@1'],
  'a@1': ['c@1'],
  'b@1': ['c@1'],
  'c@1': [],
  'c@2': []
});

//       *
//     /   \
//   a@1   b@1
//     \   /
//      c@1
//       |
//      d@1
const test2 = ({
  '*': ['a@1', 'b@1'],
  'a@1': ['b@1', 'c@1'],
  'b@1': ['c@1'],
  'c@1': ['d@1'],
  'd@1': []
});

//       *
//     /   \
//   a@1   b@1
//     \   /
//      c@1
const test3 = ({
  '*': ['a@1', 'b@1'],
  'a@1': ['c@1'],
  'b@1': ['c@1'],
  'c@1': [],
});

//        *
//      /   \
//    a@1   c@2
//   /   \
// b@1 -> c@1
const test4 = ({
  '*': ['a@1', 'c@2'],
  'a@1': ['b@1', 'c@1'],
  'b@1': ['c@1'],
  'c@1': [],
  'c@2': []
});

//     *
//    / \
//   /   \
// a@1 -> b@1
const test5 = {
  '*': ['a@1', 'b@1'],
  'a@1': ['b@1'],
  'b@1': []
};

//      *
//   /  |  \
// a@1 b@1 c@1
//   \ /
//   c@2
const test6 = {
  '*': ['a@1', 'b@1', 'c@1'],
  'a@1': ['c@2'],
  'b@1': ['c@2'],
  'c@1': [],
  'c@2': []
};

//      *
//     / \
//   a@1 b@1
//    /   \
//  c@1   c@2
const test7 = {
  '*': ['a@1', 'b@1'],
  'a@1': ['c@1'],
  'b@1': ['c@2'],
  'c@1': [],
  'c@2': []
};

//      *
//   /  |  \
// a@1 b@1 c@1
//     / \
//   a@2 c@2
//   /
//  c@1
const test8 = {
  '*': ['a@1', 'b@1', 'c@1'],
  'a@1': [],
  'a@2': ['c@1'],
  'b@1': ['a@2', 'c@2'],
  'c@1': [],
  'c@2': []
};

// A project with no dependencies
const test9 = {
  '*': []
};

export const testCases: {[testName: string]: util.DependencyGraph} = {
  test1,
  test2,
  test3,
  test4,
  test5,
  test6,
  test7,
  test8,
  test9
};