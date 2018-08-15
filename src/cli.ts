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

import meow from 'meow';

import {outputToUser} from './output';
import * as tree from './package-tree';
import * as util from './util';

const cli = meow({
  help: `  
    Usage
      node-dependency-analysis [project-Directory]
 
    Options
      --help        Prints this help message.
  `,
  flags: {help: {type: 'boolean'}}
});

if (cli.input.length !== 1) {
  console.error(`Error: should have 1 argument, but got ${cli.input.length}`);
  cli.showHelp(1);
  process.exit(1);
} else {
  run(cli.input[0]);
}

async function validNodePackage(path: string) {
  if (!util.exists(path)) {
    cli.showHelp(1);
    return false;
  }

  if (!(await util.stat(path)).isDirectory()) {
    console.error(`Error: argument must be a directory`);
    cli.showHelp(1);
    return false;
  }
  const files: string[] = await util.readdir(path);
  if (!files.includes('package.json')) {
    console.error(`Error: directory does not contain a package.json file`);
    cli.showHelp(1);
    return false;
  }
  return true;
}

async function run(packageRootDir: string) {
  // Step 1: Takes in the root of the package
  if (!(await validNodePackage(packageRootDir))) {
    process.exit(1);
  }

  // Step 3: create package tree - generatePackageTree or main function
  const emptyPackageTree = await tree.generatePackageTree(packageRootDir);
  const packageTreeWithPath =
      await tree.resolvePaths(emptyPackageTree, packageRootDir);
  const packageTreeWithPOI =
      await tree.populatePOIInPackageTree(packageTreeWithPath);

  // Step 4: output
  // TODO: Uncomment this line.
  outputToUser(packageTreeWithPOI);
}
