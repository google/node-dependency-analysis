import * as acorn from 'acorn';
import {CallExpression, Node} from 'estree';

const walk = require('acorn/dist/walk');

export const ioModules: string[] =
    ['http', 'fs', 'https', 'http2', 'net', 'datagram', 'child_process'];

export interface SearchValue {
  // A map of I/O module names and the position where they were required in a
  // file
  requiredModules: Map<string, Position>;
  // An array of positions where arguments are dynamically evaluated
  dynamicArgs: Position[];
  // An array of the positions where there are dynamic require calls
  dynamicRequire: Position[];
}

export interface Position {
  lineStart: number;
  lineEnd: number;
  colStart: number;
  colEnd: number;
}

/**
 * Searches file content for points of interest
 *
 * @param content contents of a file
 */
export async function search(content: string): Promise<SearchValue> {
  const tree = await acorn.parse(content, {locations: true});
  const nodeArr: Node[] = getRequireCalls(tree);
  const result: SearchValue = getRequiredModules(nodeArr);
  const moduleMap = result.requiredModules;
  moduleMap.forEach((val, key) => {
    if (!ioModules.includes(key)) {
      moduleMap.delete(key);
    }
  });
  const dynamicRequireCalls = getDynamicRequireCalls(tree);
  result.dynamicRequire = result.dynamicRequire.concat(dynamicRequireCalls);
  return result;
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
 * Iterates through require nodes and returns a constructed SearchValue object
 *
 * @param requireNodes array of acorn nodes that contain 'require' call
 * expression
 */
function getRequiredModules(requireNodes: Node[]): SearchValue {
  const requiredModules = new Map<string, Position>();
  const dynamicArgPos: Position[] = [];
  requireNodes.forEach((node: Node) => {
    const pos: Position = getPosition(node);

    if (node.type === 'Literal' && node.value) {
      requiredModules.set(node.value.toString(), pos);
    } else if (node.type === 'TemplateLiteral') {
      const exp = node.expressions[0];
      const qua = node.quasis;

      // String interpolation with expression inside `${}`, and no characters
      // outside of the curly braces
      if (node.expressions.length === 1 && qua.length === 2 &&
          qua[0].value.raw === '' && qua[1].value.raw === '') {
        if (exp.type === 'Literal' && exp.value) {
          requiredModules.set(exp.value.toString(), pos);
        }

        // String interpolation without expression
      } else if (qua.length === 1) {
        requiredModules.set(qua[0].value.raw, pos);
      }

      // If expression is not a literal or a template literal, it is dynamically
      // evaluated
    } else {
      dynamicArgPos.push(pos);
    }
  });
  return {requiredModules, dynamicArgs: dynamicArgPos, dynamicRequire: []};
}

/**
 * Returns list of positions where there the require identifier is used other
 * than in a call expression
 *
 * @param tree abstract syntax tree
 */
function getDynamicRequireCalls(tree: Node): Position[] {
  const dynamicRequireCalls: Position[] = [];
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
          dynamicRequireCalls.push(pos);
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
