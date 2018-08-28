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
import {CallExpression, MemberExpression, Node} from 'estree';

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
  const found = findModules(contents, file, ioModuleList);
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
  const found = findModules(contents, file, arbitraryExecutionMods);

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
      locateAliases(acornTree, 'require', IdType.CALLEE);
  requireAliasCalls.forEach((pos) => {
    const requireAliasPOI = createPOI('Dynamic Require Call', file, pos);
    requireAliasPOIs.push(requireAliasPOI);
  });

  const requireCalls = findCallee('require', acornTree);
  const dynamicRequireArgs: PointOfInterest[] =
      getRequiredModules(requireCalls, file, true);

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

  const positionsOfAliases: Position[] =
      locateAliases(acornTree, 'eval', IdType.CALLEE);
  positionsOfAliases.forEach((pos) => {
    const evalPOI = createPOI('Eval Call', file, pos);
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
      getAccesses('process', 'env', contents, file);
  return envAccesses;
}

/**
 * Finds specified function identifier and returns an array of AST nodes that
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
 * Finds specified object identifier and returns an array of AST nodes that
 * they are located in
 *
 * @param name the name of the object
 * @param tree abstract syntax tree
 */
function findObject(name: string, tree: Node): MemberExpression[] {
  const objectUsages: MemberExpression[] = [];
  walk.simple(tree, {
    MemberExpression(e: MemberExpression) {
      if (e.object.type === 'Identifier' && e.object.name === name) {
        objectUsages.push(e);
      }
    }
  });
  return objectUsages;
}

/**
 * Detects and creates POIs for accesses to the specified property of the
 * object, obscured accesses to the object, and its properties
 *
 * @param object the name of the object
 * @param property the name of the property
 * @param contents the contents of the file
 * @param file the file being checked
 */
function getAccesses(
    object: string, property: string, contents: string, file: string) {
  const accesses: PointOfInterest[] = [];
  const acornTree =
      acorn.parse(contents, {allowHashBang: true, locations: true});

  const objectUsages: MemberExpression[] = findObject(object, acornTree);
  const positionsOfPropAccesses: Position[] =
      locatePropertyAccesses(property, objectUsages);
  positionsOfPropAccesses.forEach((pos) => {
    accesses.push(createPOI(`Access to ${object}.${property}`, file, pos));
  });

  const obscuredProperties: Position[] =
      locatePropertyAccesses(property, objectUsages, true);
  obscuredProperties.forEach((pos) => {
    accesses.push(createPOI(`Obscured ${object} property`, file, pos));
  });

  const obscuredObjects: Position[] =
      locateAliases(acornTree, object, IdType.OBJECT);
  obscuredObjects.forEach((pos) => {
    accesses.push(createPOI(`Obscured ${object} object`, file, pos));
  });

  return accesses;
}

/**
 * Locates accesses to a specific property given nodes that contain the
 * object that contains the property.
 *
 * @param property the name of the property being looked for
 * @param nodes the nodes of an AST that contain the object with the property
 * @param dynamic changes the returned object
 *     true: Points Of Interest array of dynamic accesses to any property
 *     false: Points Of Interest array of accesses to the property
 */
function locatePropertyAccesses(
    property: string, nodes: MemberExpression[], dynamic = false) {
  const locationsOfPropAccesses: Position[] = [];
  const obscuredProps: Position[] = [];
  nodes.forEach((n) => {
    const pos: Position = getPosition(n);

    // Direct access to property
    if (n.property.type === 'Identifier') {
      if (n.property.name === property) {
        locationsOfPropAccesses.push(pos);
      }

      // Indexing into object
    } else if (n.property.type === 'Literal') {
      const arg = getArgument(n.property);
      if (arg === property) {
        locationsOfPropAccesses.push(pos);
      } else if (arg === null) {
        obscuredProps.push(pos);
      }

      // Anything with any type other than Literal and Identifier
    } else {
      obscuredProps.push(pos);
    }
  });

  if (dynamic) {
    return obscuredProps;
  } else {
    return locationsOfPropAccesses;
  }
}

/**
 * Iterates through nodes with the name 'require' and returns a list of
 * PointOfInterest objects that indicate specific io modules that were required
 *
 * @param requireNodes array of acorn nodes that contain the 'require' call
 *    expression
 * @param file the name of the file being checked
 * @param dynamic changes the returned object
 *     true: an array of Points Of Interest with dynamic arguments
 *     false: an array of Points Of Interest with modules being required
 */
function getRequiredModules(
    requireNodes: Node[], file: string, dynamic = false): PointOfInterest[] {
  const requiredModules: PointOfInterest[] = [];
  const dynamicEvalModules: PointOfInterest[] = [];

  requireNodes.forEach((node: Node) => {
    const pos: Position = getPosition(node);
    const arg = getArgument(node);
    if (arg === null) {
      const poi = createPOI('Dynamic Require Arg', file, pos);
      dynamicEvalModules.push(poi);
    } else {
      const poi = createPOI(arg, file, pos);
      requiredModules.push(poi);
    }
  });

  if (dynamic) {
    return dynamicEvalModules;
  } else {
    return requiredModules;
  }
}

/**
 * Returns a the string argument and 'Dynamic', indicating
 * that the argument is dynamic
 *
 * @param node the AST node containing the string argument
 */
// TODO: rename this?
function getArgument(node: Node): string|null {
  if (node.type === 'Literal' && node.value) {
    const ioMod = node.value.toString();
    return ioMod;
  } else if (node.type === 'TemplateLiteral') {
    const exp = node.expressions[0];
    const qua = node.quasis;

    // String interpolation with expression inside `${}`, and no characters
    // outside of the curly braces
    if (node.expressions.length === 1 && qua.length === 2 &&
        qua[0].value.raw === '' && qua[1].value.raw === '') {
      if (exp.type === 'Literal' && exp.value) {
        const mod = exp.value.toString();
        return mod;
      } else {
        return null;
      }

      // String interpolation without expression
    } else if (qua.length === 1) {
      const mod = qua[0].value.raw;
      return mod;
    } else {
      return null;
    }

    // If expression is not a literal or a template literal, it is dynamically
    // evaluated
  } else {
    return null;
  }
}

/**
 * Finds and creates POI for modules in the list that are required in the file
 *
 * @param contents the contents of the file
 * @param file the file being checked
 * @param moduleList the array of modules that are being searched for
 */
function findModules(contents: string, file: string, moduleList: string[]) {
  const acornTree =
      acorn.parse(contents, {locations: true, allowHashBang: true});
  const requireCalls = findCallee('require', acornTree);
  const modulesFound = getRequiredModules(requireCalls, file, false);
  const requiredModules =
      modulesFound.filter(mod => moduleList.includes(mod.type));
  return requiredModules;
}

/**
 * Given a specific identifier, this method returns a list of positions where
 * the identifier is found under aliases
 *
 * @param id the identifier being searched for
 * @param tree abstract syntax tree
 * @param file the name of the file being checked
 */
function locateAliases(tree: Node, id: string, type: IdType): Position[] {
  const positions: Position[] = [];
  walk.fullAncestor(tree, (n: Node, ancestors: Node[]) => {
    if (n && n.type === 'Identifier') {
      if (n.name === id) {
        // last element is current node and second to last it the node's
        // parent
        const parent: Node = ancestors[ancestors.length - 2];

        // If node has name of id, and isn't a callee of a Call Expression
        if (type === IdType.CALLEE &&
                (parent.type !== 'CallExpression' || parent.callee !== n)
            // If node has name of id and isn't an object of a Member Expression
            || type === IdType.OBJECT &&
                (parent.type !== 'MemberExpression' || parent.object !== n)) {
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
