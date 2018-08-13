import * as fs from 'fs';
import meow from 'meow';
import pify from 'pify';

import {outputToUser} from './output';
import {generatePackageTree} from './package-tree';

const cli = meow({
  help: `  
    Usage
      $ TODO <project>
 
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
  try {
    await pify(fs.stat)(path);
  } catch (err) {
    console.error(err);
    cli.showHelp(1);
    return false;
  }
  const fileInfo = await pify(fs.stat)(path);
  if (!fileInfo.isDirectory()) {
    console.error(`Error: argument must be a directory`);
    cli.showHelp(1);
    return false;
  }
  const files: string[] = await pify(fs.readdir)(path);
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

  // Step 2: Read package.json
  const pJson = await pify(fs.readFile)('package.json');

  // Step 3: create package tree - generatePackageTree or main function
  const packageTree = generatePackageTree(pJson);

  // Step 4: output
  outputToUser(packageTree);
}
