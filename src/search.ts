import * as acorn from 'acorn';
import {CallExpression, Node} from 'estree';

const walk = require('acorn/dist/walk');

export const ioModules: string[] =
    ['http', 'fs', 'https', 'http2', 'net', 'datagram', 'child_process'];

/**
 * requiredModules: A map of module names and the position where they were
 * required in a file dynamicEvals: An array of the locations where require is
 * called dynamically
 */
export interface SearchValue {
  requiredModules: Map<string, Position>;
  dynamicEvals: Position[];
}

/**
 * location of where require is called dynamically
 */
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
  const dynamicEvalPos: Position[] = [];
  requireNodes.forEach((node: Node) => {
    const pos: Position = {lineStart: 0, lineEnd: 0, colStart: 0, colEnd: 0};
    if (node.loc) {
      pos.lineStart = node.loc.start.line, pos.lineEnd = node.loc.end.line,
      pos.colStart = node.loc.start.column, pos.colEnd = node.loc.end.column;
    }

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
      dynamicEvalPos.push(pos);
    }
  });
  return {requiredModules, dynamicEvals: dynamicEvalPos};
}
