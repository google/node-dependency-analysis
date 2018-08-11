import * as pkg from './package-tree';
function main(packageRootDir: string) {
  // Step 1: Takes in the root of the package
  // Step 2: Read package.json
  // Step 3: For each top level dependency build a PackageTree
  // Step 4: Run the analysis on each package in a package tree (Build array of
  // functions to execute from flags passed in) Step 5: Print output to user
}

run();
function run() {
  pkg.getJSFiles('./node_modules/acorn/');
}
