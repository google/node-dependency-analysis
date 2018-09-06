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

import * as acorn from 'acorn';
import {Node} from 'estree';

import * as analysisUtil from './analysis-util';
import {PointOfInterest} from './package-graph';

/**
 * Gets a list of PointOfInterest objects, indicating that there were IO
 * modules that were required in a file
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getIOModules(acornTree: Node, file: string): PointOfInterest[] {
  const ioModuleList: string[] =
      ['http', 'fs', 'https', 'http2', 'net', 'datagram'];
  const found = analysisUtil.findModules(acornTree, file, ioModuleList);
  return found;
}

/**
 * Gets a list of PointOfInterest objects, indicating that there were
 * required modules that can execute arbitrary code
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getArbitraryExecutionMods(
    acornTree: Node, file: string): PointOfInterest[] {
  const arbitraryExecutionMods: string[] =
      ['child_process', 'repl', 'vm', 'module'];
  const found =
      analysisUtil.findModules(acornTree, file, arbitraryExecutionMods);

  return found;
}

/**
 * Gets a list of PointOfInterest objects indicating unconventional
 * uses of require in a file
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function unusualUsesOfRequire(
    acornTree: Node, file: string): PointOfInterest[] {
  const requireAliasPOIs: PointOfInterest[] =
      analysisUtil.locateAliases(acornTree, file, 'require');

  const requireCalls = analysisUtil.findCallee('require', acornTree);
  const dynamicRequireArgs: PointOfInterest[] =
      analysisUtil.getRequiredModules(requireCalls, file, true);

  const accessedRequireProps: PointOfInterest[] =
      analysisUtil.locatePropAccessesOfFuncs(acornTree, file, 'require');

  return [...requireAliasPOIs, ...dynamicRequireArgs, ...accessedRequireProps];
}

/**
 * Creates a Point of Interest object if there are syntax error(s) in a file
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getSyntaxError(contents: string, file: string): PointOfInterest|
    null {
  try {
    acorn.parse(contents, {allowHashBang: true, locations: true});
  } catch (err) {
    const pos = {lineStart: 0, lineEnd: 0, colStart: 0, colEnd: 0};
    const syntaxError = analysisUtil.createPOI('Syntax Error', file, pos);
    return syntaxError;
  }
  return null;
}

/**
 * Gets a list of PointOfInterest objects that indicate usages of eval
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getEvalCalls(acornTree: Node, file: string): PointOfInterest[] {
  const evalPOIs: PointOfInterest[] = [];
  const foundStandardEvalCalls: Node[] =
      analysisUtil.findCallee('eval', acornTree);
  foundStandardEvalCalls.forEach((node) => {
    const evalPOI = analysisUtil.createPOI(
        'Eval Call', file, analysisUtil.getPosition(node));
    evalPOIs.push(evalPOI);
  });

  const evalAliases: PointOfInterest[] =
      analysisUtil.locateAliases(acornTree, file, 'eval');

  const evalPropAccesses: PointOfInterest[] =
      analysisUtil.locatePropAccessesOfFuncs(acornTree, file, 'eval');

  return [...evalPOIs, ...evalAliases, ...evalPropAccesses];
}

/**
 * Returns Points Of Interest that indicate uses of process.env and
 * dynamic calls to process and the properties in process
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getEnvAccesses(
    acornTree: Node, file: string): PointOfInterest[] {
  const envAccesses: PointOfInterest[] =
      analysisUtil.getAccesses('process', 'env', acornTree, file);
  const obscuredProcessAccesses: PointOfInterest[] =
      analysisUtil.getDynamicAccesses('process', acornTree, file);
  return [...envAccesses, ...obscuredProcessAccesses];
}

/**
 * Returns Points Of Interest that indicate uses of the Function Class
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getFunctionClassAccesses(acornTree: Node, file: string) {
  const functionClassPOIs: PointOfInterest[] = [];

  const functionClassUsages: Node[] =
      analysisUtil.findCallee('Function', acornTree);
  functionClassUsages.forEach((node) => {
    const functionClassPOI = analysisUtil.createPOI(
        'Function constructor usage', file, analysisUtil.getPosition(node));
    functionClassPOIs.push(functionClassPOI);
  });

  const functionAliases: PointOfInterest[] =
      analysisUtil.locateAliases(acornTree, file, 'Function');

  const functionPropAccesses: PointOfInterest[] =
      analysisUtil.locatePropAccessesOfFuncs(acornTree, file, 'Function');

  return [...functionClassPOIs, ...functionAliases, ...functionPropAccesses];
}

/**
 * Returns Points Of Interest that indicate uses of specific global properties
 *
 * @param acornTree the AST of the file
 * @param file the name of the file being checked
 */
export function getAccessesToGlobalProps(acornTree: Node, file: string) {
  const accessesToGlobalProps: PointOfInterest[] = [];
  const bannedProps = ['Function', 'require', 'eval'];
  bannedProps.forEach((prop) => {
    const accessToGlobalProp =
        analysisUtil.getAccesses('global', prop, acornTree, file);

    accessesToGlobalProps.push(...accessToGlobalProp);
  });
  const obfuscatedGlobal =
      analysisUtil.getDynamicAccesses('global', acornTree, file);
  return [...accessesToGlobalProps, ...obfuscatedGlobal];
}
