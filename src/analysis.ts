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
  const acornTree = acorn.parse(contents, {locations: true});
  const requireCalls = getRequireCalls(acornTree);
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
  const acornTree = acorn.parse(contents, {locations: true});
  const dynamicRequireCalls: PointOfInterest[] =
      getDynamicRequireCalls(acornTree, file);

  const requireCalls = getRequireCalls(acornTree);
  const dynamicRequireArgs: PointOfInterest[] =
      getRequiredModules(requireCalls, file, true);

  dynamicEvals.push(...dynamicRequireArgs);
  dynamicEvals.push(...dynamicRequireCalls);
  return dynamicEvals;
}

/**
 * Returns a list of acorn nodes that contain 'require' call expressions
 *
 * @param tree abstract syntax tree
 */
function getRequireCalls(tree: Node) {
  const requireCalls: Node[] = [];
  walk.simple(tree, {
    CallExpression(e: CallExpression) {
      if (e.callee.type === 'Identifier' && e.callee.name === 'require') {
        requireCalls.push(e.arguments[0]);
      }
    }
  });
  return requireCalls;
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
          requiredModules.push({type: mod, fileName: file, position: pos});
        }

        // String interpolation without expression
      } else if (qua.length === 1) {
        const mod = qua[0].value.raw;
        requiredModules.push({type: mod, fileName: file, position: pos});
      } else {
        dynamicEvalModules.push(
            {type: 'Dynamic Require Arg', fileName: file, position: pos});
      }

      // If expression is not a literal or a template literal, it is dynamically
      // evaluated
    } else {
      dynamicEvalModules.push(
          {type: 'Dynamic Require Arg', fileName: file, position: pos});
    }
  });

  if (dynamic) {
    return dynamicEvalModules;
  } else {
    return requiredModules;
  }
}

/**
 * Returns list of PointOfInterest objects, indicating that the require
 * identifier was used other than in a call expression
 *
 * @param tree abstract syntax tree
 * @param file the name of the file being checked
 */
function getDynamicRequireCalls(tree: Node, file: string): PointOfInterest[] {
  const dynamicRequireCalls: PointOfInterest[] = [];
  walk.fullAncestor(tree, (n: Node, ancestors: Node[]) => {
    if (n.type === 'Identifier' && n && n !== undefined) {
      if (n.name === 'require') {
        // last element is current node and second to last it the node's
        // parent
        const parent: Node = ancestors[ancestors.length - 2];
        if (parent.type !== 'CallExpression' || parent.arguments.length !== 1) {
          // Dynamic Require call

          // Get the entire line which is the second element of ancestors
          // array b/c 1st is the program
          const pos: Position = getPosition(ancestors[1]);
          dynamicRequireCalls.push(
              {type: 'Dynamic Require Call', fileName: file, position: pos});
        }
      }
    }
  });
  return dynamicRequireCalls;
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
