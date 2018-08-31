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
import {CallExpression, MemberExpression, Node} from 'estree';

import {PointOfInterest, Position} from './package-tree';

const walk = require('acorn/dist/walk');

export enum IdType {
  CALLEE,
  OBJECT
}

/**
 * Finds specified function identifier and returns an array of AST nodes that
 * they are located in
 *
 * @param id the identifier that is being searched for
 * @param tree abstract syntax tree
 */
export function findCallee(id: string, tree: Node): Node[] {
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
export function findObject(name: string, tree: Node): MemberExpression[] {
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
 * object
 *
 * @param object the name of the object
 * @param property the name of the property
 * @param acornTree abstract syntax tree
 * @param file the file being checked
 */
export function getAccesses(
    object: string, property: string, acornTree: Node, file: string) {
  const accesses: PointOfInterest[] = [];

  const objectUsages: MemberExpression[] = findObject(object, acornTree);
  const positionsOfPropAccesses: Position[] =
      locatePropertyAccesses(property, objectUsages);
  positionsOfPropAccesses.forEach((pos) => {
    accesses.push(createPOI(`Access to ${object}.${property}`, file, pos));
  });

  return accesses;
}

/**
 * Detects and creates POIs for obscured accesses to the object,
 * and its properties
 *
 * @param object the name of the object
 * @param acornTree abstract syntax tree
 * @param file the file being checked
 */
export function getDynamicAccesses(
    object: string, acornTree: Node, file: string) {
  const dynamicAccesses: PointOfInterest[] = [];
  const objectUsages: MemberExpression[] = findObject(object, acornTree);
  const obscuredProperties: Position[] =
      locateIndexPropertyAccesses(objectUsages);
  obscuredProperties.forEach((pos) => {
    dynamicAccesses.push(createPOI(`Obscured ${object} property`, file, pos));
  });

  const obscuredObjects: PointOfInterest[] =
      locateAliases(acornTree, file, object);
  dynamicAccesses.push(...obscuredObjects);

  return dynamicAccesses;
}

/**
 * Locates accesses to a specific property given AST nodes that contain the
 * object that contains the property.
 *
 * @param property the name of the property being looked for
 * @param nodes the nodes of an AST that contain the object with the property
 */
export function locatePropertyAccesses(
    property: string, nodes: MemberExpression[]) {
  const locationsOfPropAccesses: Position[] = [];
  nodes.forEach((n) => {
    const pos: Position = getPosition(n);

    // Direct access to property
    if (n.property.type === 'Identifier') {
      if (n.property.name === property) {
        locationsOfPropAccesses.push(pos);
      }

      // Indexing into object
    } else {
      const arg = getArgument(n.property);
      if (arg === property) {
        locationsOfPropAccesses.push(pos);
      }
    }
  });

  return locationsOfPropAccesses;
}

/**
 * Locates dynamic accesses of an object and its properties given AST nodes
 *
 * @param nodes the nodes of an AST that contain the object with the property
 */
export function locateIndexPropertyAccesses(nodes: MemberExpression[]):
    Position[] {
  const indexPropsPos: Position[] = [];
  nodes.forEach((n) => {
    const pos: Position = getPosition(n);

    const arg = getArgument(n.property);
    if (arg === null && n.property.type !== 'Identifier') {
      indexPropsPos.push(pos);
    }
  });
  return indexPropsPos;
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
export function getRequiredModules(
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
export function getArgument(node: Node): string|null {
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
 * @param acornTree abstract syntax tree
 * @param file the file being checked
 * @param moduleList the array of modules that are being searched for
 */
export function findModules(
    acornTree: Node, file: string, moduleList: string[]) {
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
 * @param tree abstract syntax tree
 * @param id the identifier being searched for
 */
export function locateAliases(
    tree: Node, file: string, id: string): PointOfInterest[] {
  const pois: PointOfInterest[] = [];
  walk.fullAncestor(tree, (n: Node, ancestors: Node[]) => {
    if (n && n.type === 'Identifier') {
      if (n.name === id) {
        // last element is current node and second to last it the node's
        // parent
        const parent: Node = ancestors[ancestors.length - 2];

        // Assignment to variable
        if ((parent.type === 'VariableDeclarator') ||
            (parent.type === 'AssignmentExpression') ||

            // Potential assignment to variable
            (parent.type === 'LogicalExpression') ||
            (parent.type === 'ConditionalExpression') ||
            (parent.type === 'BinaryExpression' && parent.operator === '+') ||

            // Argument of a call expression
            (parent.type === 'CallExpression' &&
             parent.arguments.some((arg) => {
               return arg.type === 'Identifier' && arg.name === id;
             })) ||

            // return statement
            (parent.type === 'ReturnStatement' && parent.argument &&
             parent.argument.type === 'Identifier' &&
             parent.argument.name === id)) {
          const pos: Position = getPosition(parent);
          pois.push(createPOI(`Obfuscated ${id} identifier`, file, pos));
        }
      }
    }
  });
  return pois;
}

/**
 * Given a specific identifier, this method returns a list of positions where
 * the identifier is found under aliases
 *
 * @param acornTree
 * @param id
 */
export function locatePropAccessesOfFuncs(
    acornTree: Node, file: string, id: string) {
  const pois: PointOfInterest[] = [];
  walk.fullAncestor(acornTree, (n: Node, ancestors: Node[]) => {
    if (n && n.type === 'Identifier') {
      if (n.name === id) {
        // last element is current node and second to last it the node's
        // parent
        const parent: Node = ancestors[ancestors.length - 2];

        // Assignment to variable
        if (parent.type === 'MemberExpression' && parent.object === n) {
          const pos: Position = getPosition(parent);
          pois.push(createPOI(`Access to a property of ${id}`, file, pos));
        }
      }
    }
  });
  return pois;
}

/**
 * Returns a Position object with the line and column of node
 *
 * @param node node that position will be retrieved from
 */
export function getPosition(node: Node): Position {
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
export function createPOI(
    type: string, fileName: string, position: Position): PointOfInterest {
  return {type, fileName, position};
}
