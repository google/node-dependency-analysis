import {TestProject} from './util';

//         *
//     /   |   \
//   a@1  b@1  c@2
//     \   /
//      c@1
export const test1 = new TestProject({
  '*': ['a@1', 'c@2'],
  'a@1': ['b@1', 'c@1'],
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
export const test2 = new TestProject({
  '*': ['a@1', 'c@2'],
  'a@1': ['b@1', 'c@1'],
  'b@1': ['c@1'],
  'c@1': ['d@1'],
  'd@1': []
});
