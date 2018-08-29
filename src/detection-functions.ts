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
import {PointOfInterest, Position} from './package-tree';

const walk = require('acorn/dist/walk');

enum IdType {
  CALLEE,
  OBJECT
}

/**
 * Gets a list of PointOfInterest objects, indicating that there were IO
 * modules that were required in a file
 *
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getIOModules(
    contents: string, file: string): PointOfInterest[] {
  const ioModuleList: string[] =
      ['http', 'fs', 'https', 'http2', 'net', 'datagram'];
  const found = analysisUtil.findModules(contents, file, ioModuleList);
  return found;
}

/**
 * Gets a list of PointOfInterest objects, indicating that there were
 * required modules that can execute arbitrary code
 *
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getArbitraryExecutionMods(
    contents: string, file: string): PointOfInterest[] {
  const arbitraryExecutionMods: string[] =
      ['child_process', 'repl', 'vm', 'module'];
  const found =
      analysisUtil.findModules(contents, file, arbitraryExecutionMods);

  return found;
}

/**
 * Gets a list of PointOfInterest objects, indicating that dynamic
 * evaluation was used in the file
 *
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getDynamicRequires(
    contents: string, file: string): PointOfInterest[] {
  const acornTree =
      acorn.parse(contents, {allowHashBang: true, locations: true});

  const requireAliasPOIs: PointOfInterest[] = [];

  const requireAliasCalls: Position[] =
      analysisUtil.locateAliases(acornTree, 'require', IdType.CALLEE);
  requireAliasCalls.forEach((pos) => {
    const requireAliasPOI =
        analysisUtil.createPOI('Dynamic Require Call', file, pos);
    requireAliasPOIs.push(requireAliasPOI);
  });

  const requireCalls = analysisUtil.findCallee('require', acornTree);
  const dynamicRequireArgs: PointOfInterest[] =
      analysisUtil.getRequiredModules(requireCalls, file, true);

  return [...requireAliasPOIs, ...dynamicRequireArgs];
}

/**
 * Creates a Point of Interest object if there are syntax error(s) in a file
 *
 * @param contents the contents of the file
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
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getEvalCalls(
    contents: string, file: string): PointOfInterest[] {
  const evalPOIs: PointOfInterest[] = [];

  const acornTree =
      acorn.parse(contents, {allowHashBang: true, locations: true});
  const foundStandardEvalCalls: Node[] =
      analysisUtil.findCallee('eval', acornTree);
  foundStandardEvalCalls.forEach((node) => {
    const evalPOI = analysisUtil.createPOI(
        'Eval Call', file, analysisUtil.getPosition(node));
    evalPOIs.push(evalPOI);
  });

  const positionsOfAliases: Position[] =
      analysisUtil.locateAliases(acornTree, 'eval', IdType.CALLEE);
  positionsOfAliases.forEach((pos) => {
    const evalPOI = analysisUtil.createPOI('Eval Call', file, pos);
    evalPOIs.push(evalPOI);
  });
  return evalPOIs;
}

/**
 * Returns Points Of Interest that indicate uses of process.env and
 * dynamic calls to process and the properties in process
 *
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getEnvAccesses(
    contents: string, file: string): PointOfInterest[] {
  const envAccesses: PointOfInterest[] =
      analysisUtil.getAccesses('process', 'env', contents, file);
  const obscuredProcessAccesses: PointOfInterest[] =
      analysisUtil.getDynamicAccesses('process', contents, file);
  return [...envAccesses, ...obscuredProcessAccesses];
}
