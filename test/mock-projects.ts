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
const project1 = {
  '*': ['a@1', 'b@1', 'c@2'],
  'a@1': ['c@1'],
  'b@1': ['c@1'],
  'c@1': [],
  'c@2': []
};

//       *
//     /   \
//   a@1   b@1
//     \   /
//      c@1
//       |
//      d@1
const project2 = {
  '*': ['a@1', 'b@1'],
  'a@1': ['c@1'],
  'b@1': ['c@1'],
  'c@1': ['d@1'],
  'd@1': []
};

//       *
//       |
//      a@1
//       |
//      b@1
//       |
//      c@1
//       |
//      d@1
const project3 = {
  '*': ['a@1'],
  'a@1': ['b@1'],
  'b@1': ['c@1'],
  'c@1': ['d@1'],
  'd@1': []
};

//       *
//       |
//      a@1
//       |
//      b@2
const project4 = {
  '*': ['a@1'],
  'a@1': ['b@1'],
  'b@1': [],
};

//       *
//       |
//      a@1
const project5 = {
  '*': ['a@1'],
  'a@1': []
};

//      *
//    /    \
//   a@1 -> b@1
//     \   /
//      c@1
//       |
//      d@1
const project6 = ({
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
const project7 = ({
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
const project8 = ({
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
const project9 = {
  '*': ['a@1', 'b@1'],
  'a@1': ['b@1'],
  'b@1': []
};

//      *
//   /  |  \
// a@1 b@1 c@1
//   \ /
//   c@2
const project10 = {
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
const project11 = {
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
const project12 = {
  '*': ['a@1', 'b@1', 'c@1'],
  'a@1': [],
  'a@2': ['c@1'],
  'b@1': ['a@2', 'c@2'],
  'c@1': [],
  'c@2': []
};

// A project with no dependencies
const project13 = {
  '*': []
};

export const testCases: {[testName: string]: util.DependencyGraph} = {
  project1,
  project2,
  project3,
  project4,
  project5,
  project6,
  project7,
  project8,
  project9,
  project10,
  project11,
  project12,
  project13,
};
