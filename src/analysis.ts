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

// This file will hold all the functions that do analysis of packages.
import * as acorn from 'acorn';
import {CallExpression, Node} from 'estree';
import {PointOfInterest, Position} from './package-tree';

const walk = require('acorn/dist/walk');

export const ioModuleList: string[] =
    ['http', 'fs', 'https', 'http2', 'net', 'datagram', 'child_process'];

/**
 * Gets a list of PointOfInterest objects, indicating that there were IO
 * modules that were required in a file
 *
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getIOModules(
    contents: string, file: string): PointOfInterest[] {
  const acornTree =
      acorn.parse(contents, {locations: true, allowHashBang: true});
  const requireCalls = findCallee('require', acornTree);
  const moduleList = getRequiredModules(requireCalls, file, false);
  const requiredIOModules =
      moduleList.filter(mod => ioModuleList.includes(mod.type));
  return requiredIOModules;
}

/**
 * Gets a list of PointOfInterest objects, indicating that dynamic
 * evaluation was used in the file
 *
 * @param contents the contents of the file
 * @param file the name of the file being checked
 */
export function getDynamicEval(
    contents: string, file: string): PointOfInterest[] {
  const dynamicEvals: PointOfInterest[] = [];
  const acornTree =
      acorn.parse(contents, {allowHashBang: true, locations: true});

  const requireAliasPOIs: PointOfInterest[] = [];

  const requireAliasCalls: Position[] =
      locateCalleeAliases('require', acornTree);
  requireAliasCalls.forEach((pos) => {
    const requireAliasPOI = createPOI('Dynamic Require Call', file, pos);
    requireAliasPOIs.push(requireAliasPOI);
  });

  const requireCalls = findCallee('require', acornTree);
  const dynamicRequireArgs: PointOfInterest[] =
      getRequiredModules(requireCalls, file, true);

  dynamicEvals.push(...dynamicRequireArgs);
  dynamicEvals.push(...requireAliasPOIs);
  return dynamicEvals;
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
    const syntaxError = createPOI('Syntax Error', file, pos);
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
  const foundStandardEvalCalls: Node[] = findCallee('eval', acornTree);
  foundStandardEvalCalls.forEach((node) => {
    const evalPOI = createPOI('Eval Call', file, getPosition(node));
    evalPOIs.push(evalPOI);
  });

  const positionsOfAliases: Position[] = locateCalleeAliases('eval', acornTree);
  positionsOfAliases.forEach((pos) => {
    const evalPOI = createPOI('Eval Call', file, pos);
    evalPOIs.push(evalPOI);
  });
  return evalPOIs;
}

/**
 * Finds specified identifiers and returns the AST node that
 * they are located in
 *
 * @param id the identifier that is being searched for
 * @param tree abstract syntax tree
 */
function findCallee(id: string, tree: Node): Node[] {
  const calleeUsages: Node[] = [];
  walk.simple(tree, {
    CallExpression(e: CallExpression) {
      if (e.callee.type === 'Identifier' && e.callee.name === id) {
        calleeUsages.push(e.arguments[0]);
      }
    }
  });
  return calleeUsages;
}

/**
 * Iterates through nodes with the name 'require' and returns a list of
 * PointOfInterest objects that indicate specific io modules that were required
 *
 * @param requireNodes array of acorn nodes that contain the 'require' call
 *    expression
 * @param file the name of the file being checked
 */
function getRequiredModules(
    requireNodes: Node[], file: string, dynamic: boolean): PointOfInterest[] {
  const requiredModules: PointOfInterest[] = [];
  const dynamicEvalModules: PointOfInterest[] = [];

  requireNodes.forEach((node: Node) => {
    const pos: Position = getPosition(node);

    if (node.type === 'Literal' && node.value) {
      const ioMod = node.value.toString();
      requiredModules.push({type: ioMod, fileName: file, position: pos});
    } else if (node.type === 'TemplateLiteral') {
      const exp = node.expressions[0];
      const qua = node.quasis;

      // String interpolation with expression inside `${}`, and no characters
      // outside of the curly braces
      if (node.expressions.length === 1 && qua.length === 2 &&
          qua[0].value.raw === '' && qua[1].value.raw === '') {
        if (exp.type === 'Literal' && exp.value) {
          const mod = exp.value.toString();
          requiredModules.push(createPOI(mod, file, pos));
        }

        // String interpolation without expression
      } else if (qua.length === 1) {
        const mod = qua[0].value.raw;
        requiredModules.push({type: mod, fileName: file, position: pos});
      } else {
        dynamicEvalModules.push(createPOI('Dynamic Require Arg', file, pos));
      }

      // If expression is not a literal or a template literal, it is dynamically
      // evaluated
    } else {
      dynamicEvalModules.push(createPOI('Dynamic Require Arg', file, pos));
    }
  });

  if (dynamic) {
    return dynamicEvalModules;
  } else {
    return requiredModules;
  }
}

/**
 * Given a specific identifier, this method returns a list of positions where
 * the identifier is found under aliases
 *
 * @param id the identifier being searched for
 * @param tree abstract syntax tree
 * @param file the name of the file being checked
 */
function locateCalleeAliases(id: string, tree: Node): Position[] {
  const positions: Position[] = [];
  walk.fullAncestor(tree, (n: Node, ancestors: Node[]) => {
    if (n.type === 'Identifier' && n && n !== undefined) {
      if (n.name === id) {
        // last element is current node and second to last it the node's
        // parent
        const parent: Node = ancestors[ancestors.length - 2];

        // If node has name of id, and isn't a callee of a Call Expression
        if (parent.type !== 'CallExpression' || parent.callee !== n) {
          // Get the second element of ancestors array b/c 1st is the program
          const pos: Position = getPosition(ancestors[1]);
          positions.push(pos);
        }
      }
    }
  });
  return positions;
}

/**
 * Returns a Position object with the line and column of node
 *
 * @param node node that position will be retrieved from
 */
function getPosition(node: Node): Position {
  const pos: Position = {lineStart: 0, lineEnd: 0, colStart: 0, colEnd: 0};
  if (node.loc) {
    pos.lineStart = node.loc.start.line, pos.lineEnd = node.loc.end.line,
    pos.colStart = node.loc.start.column, pos.colEnd = node.loc.end.column;
  }
  return pos;
}

/**
 * Creates a Point of Interest(poi) object
 *
 * @param type the type of poi
 * @param file the file in which the poi is located
 * @param position the location in the file that the poi is located
 */
function createPOI(
    type: string, fileName: string, position: Position): PointOfInterest {
  return {type, fileName, position};
}
