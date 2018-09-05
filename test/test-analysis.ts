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
import test from 'ava';

import {file} from 'tmp';
import * as analysis from '../src/detection-functions';

test(
    'getIOModules should detect http module in standard require http case',
    async t => {
      const content = 'const a = require("http");';
      const acornTree = parse(content);
      const result = analysis.getIOModules(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'http');
    });

test(
    'getIOModules should not detect http module when there are no ' +
        'require calls',
    async t => {
      const content1 = 'console.log("http")';
      const acornTree1 = parse(content1);
      const result1 = analysis.getIOModules(acornTree1, 'file');
      t.deepEqual(result1.length, 0);
    });

test('getIOModules should not detect contain util modules', async t => {
  const content = 'const a = require("util");\nconst b = require("path");';
  const acornTree = parse(content);
  const result = analysis.getIOModules(acornTree, 'file');
  t.deepEqual(result.length, 0);
});

test(
    'getIOModules should detect http module when require arg in ' +
        'template literals',
    async t => {
      const content1 = 'const a = require(`${"http"}`);';
      const acornTree1 = parse(content1);
      const result1 = analysis.getIOModules(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'http');

      const content2 = 'const a = require(`http`);';
      const acornTree2 = parse(content2);
      const result2 = analysis.getIOModules(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'http');

      const content3 = 'a = require("http");';
      const acornTree3 = parse(content3);
      const result3 = analysis.getIOModules(acornTree3, 'file');
      t.deepEqual(result3.length, 1);
      t.deepEqual(result3[0].type, 'http');
    });

test('getIOModules should detect both http and fs module', async t => {
  const content = 'const a = require("http");\n const b = require(`${"fs"}`);';
  const acornTree = parse(content);
  const result = analysis.getIOModules(acornTree, 'file');
  t.deepEqual(result.length, 2);
  t.deepEqual(result[0].type, 'http');
  t.deepEqual(result[1].type, 'fs');
});

test(
    'getArbitraryExecutionMods should detect child_process, repl, vm, module',
    async t => {
      const content1 = 'const a = require("child_process");';
      const acornTree1 = parse(content1);
      const result1 = analysis.getArbitraryExecutionMods(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'child_process');

      const content2 = 'const b = require("repl");';
      const acornTree2 = parse(content2);
      const result2 = analysis.getArbitraryExecutionMods(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'repl');

      const content3 = 'require("vm").runInNewContext("doSomething();")';
      const acornTree3 = parse(content3);
      const result3 = analysis.getArbitraryExecutionMods(acornTree3, 'file');
      t.deepEqual(result3.length, 1);
      t.deepEqual(result3[0].type, 'vm');

      const content4 = 'const b = require("module");';
      const acornTree4 = parse(content4);
      const result4 = analysis.getArbitraryExecutionMods(acornTree4, 'file');
      t.deepEqual(result4.length, 1);
      t.deepEqual(result4[0].type, 'module');
    });

test(
    'unusualUsesOfRequire should detect concatenation of strings that forms http ' +
        'as a dynamic require arg',
    async t => {
      const content = 'const a = require("h" + "t" + "t" + "p");';
      const acornTree = parse(content);
      const result = analysis.unusualUsesOfRequire(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Arg');
    });

test(
    'unusualUsesOfRequire should detect substring that forms http as a' +
        'dynamic require arg',
    async t => {
      const content1 =
          `const a = "anotherhttp"\nconst b = require(a.substring(6));`;
      const acornTree1 = parse(content1);
      const result1 = analysis.unusualUsesOfRequire(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Dynamic Require Arg');

      const content2 = 'const a = require("anotherhttp".substring(6))';
      const acornTree2 = parse(content2);
      const result2 = analysis.unusualUsesOfRequire(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Dynamic Require Arg');
    });

test(
    'unusualUsesOfRequire should detect function that returns http as a ' +
        'dynamic require arg',
    async t => {
      const content =
          'function returnHttp(){return "http";}\nconst a = require(returnHttp);';
      const acornTree = parse(content);
      const result = analysis.unusualUsesOfRequire(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Arg');
    });

test(
    'unusualUsesOfRequire should detect if require callee is defined' +
        'as a variable',
    async t => {
      const content = `const a = require; 
                        const b = a("https");`;
      const acornTree = parse(content);
      const result = analysis.unusualUsesOfRequire(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Obfuscated require identifier');

      const content2 = 'a = require;';
      const acornTree2 = parse(content2);
      const result2 = analysis.unusualUsesOfRequire(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Obfuscated require identifier');
    });

test(
    'unusualUsesOfRequire should detect if require identifier is ' +
        'returned in a function',
    async t => {
      const content = 'function returnRequire(){return require;}\n ' +
          'const a = returnRequire();\nconst b = a("http");';
      const acornTree = parse(content);
      const result = analysis.unusualUsesOfRequire(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Obfuscated require identifier');
    });

test(
    'unusualUsesOfRequire should detect if require identifier is ' +
        'passed as a parameter in a function',
    async t => {
      const content =
          'function f(a, b){return a(b)}\nconst a = f(require, "http");';
      const acornTree = parse(content);
      const result = analysis.unusualUsesOfRequire(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Obfuscated require identifier');
    });


test(
    'unusualUsesOfRequire should not return a POI when' +
        'the require object and property is being used',
    async t => {
      const content = 'const a = global.require;';
      const acornTree = parse(content);
      const result = analysis.unusualUsesOfRequire(acornTree, 'file');
      t.deepEqual(result.length, 0);
    });

test(
    'unusualUsesOfRequire should detect cases where require is ' +
        'assigned to a variable',
    async t => {
      const content1 = 'const r = require || 0;';
      const acornTree1 = parse(content1);
      const result1 = analysis.unusualUsesOfRequire(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Obfuscated require identifier');

      const content2 = 'r = require + 0;';
      const acornTree2 = parse(content2);
      const result2 = analysis.unusualUsesOfRequire(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Obfuscated require identifier');
    });

test(
    'when there is a syntax error in a file, getSyntaxError should return ' +
        'a syntax poi',
    async t => {
      const content = 'const s = "';
      const result = analysis.getSyntaxError(content, 'file');
      t.notDeepEqual(result, null);
      t.deepEqual(result!.type, 'Syntax Error');
    });

test(
    'when there is no syntax errors in a file, getSyntaxError should ' +
        'not return a poi',
    async t => {
      const content = 'const s = "string"';
      const result = analysis.getSyntaxError(content, 'file');
      t.deepEqual(result, null);
    });

test('getEvalCalls should return pois for standard eval() usages', async t => {
  const content = 'const e = eval(doSomethingBad())';
  const acornTree = parse(content);
  const result = analysis.getEvalCalls(acornTree, 'file');
  t.deepEqual(result.length, 1);
  t.deepEqual(result[0].type, 'Eval Call');
});

test(
    'getEvalCalls should return pois for eval identifiers under aliases',
    async t => {
      const content1 = 'const e = eval; e(doSomethingBad());';
      const acornTree1 = parse(content1);
      const result1 = analysis.getEvalCalls(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Obfuscated eval identifier');

      const content2 =
          'doSomethingBad(eval); function doSomethingBad(something)' +
          '{something(doSomethingReallyBad());}';
      const acornTree2 = parse(content2);
      const result2 = analysis.getEvalCalls(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Obfuscated eval identifier');
    });

test(
    'getEvalCalls should return a POIs when eval\'s properties are accessed',
    async t => {
      const content = 'const e = eval.call(null, "doSomethingBad")';
      const acornTree = parse(content);
      const result = analysis.getEvalCalls(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Access to a property of eval');
    });

test(
    'getEnvAccesses should return pois for accesses to the env ' +
        'property in the process object',
    async t => {
      const content1 = 'const r = process.env.SOME_TOKEN';
      const acornTree1 = parse(content1);
      const result1 = analysis.getEnvAccesses(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Access to process.env');


      const content2 = 'const r = process["env"].SOME_TOKEN';
      const acornTree2 = parse(content2);
      const result2 = analysis.getEnvAccesses(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Access to process.env');

      const content3 = 'doBadThings(Object.keys(process["env"]).map' +
          '(k => process["env"][k]));';
      const acornTree3 = parse(content3);
      const result3 = analysis.getEnvAccesses(acornTree3, 'file');
      t.deepEqual(result3.length, 2);

      const content4 = 'process[`${"env"}`]';
      const acornTree4 = parse(content4);
      const result4 = analysis.getEnvAccesses(acornTree4, 'file');
      t.deepEqual(result4.length, 1);
      t.deepEqual(result4[0].type, 'Access to process.env');
    });

test('getEnvAccesses should return pois for obscured properties', async t => {
  const content1 = 'const r = process["e" + "n" + "v"]';
  const acornTree1 = parse(content1);
  const result1 = analysis.getEnvAccesses(acornTree1, 'file');
  t.deepEqual(result1.length, 1);
  t.deepEqual(result1[0].type, 'Obscured process property');

  const content2 = 'process[`e${middle}v`]';
  const acornTree2 = parse(content2);
  const result2 = analysis.getEnvAccesses(acornTree2, 'file');
  t.deepEqual(result2.length, 1);
  t.deepEqual(result2[0].type, 'Obscured process property');
});

test(
    'getEnvAccesses should return pois for obscured process objects',
    async t => {
      const content = 'doSomething(process); function doSomething(s)' +
          '{return s.env.NPM_TOKEN;}';
      const acornTree = parse(content);
      const result = analysis.getEnvAccesses(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Obfuscated process identifier');
    });

test(
    'getEnvAccesses should not return pois when other other ' +
        'properties of process are being accessed',
    async t => {
      const content = 'const arvs = process.argv;';
      const acornTree = parse(content);
      const result = analysis.getEnvAccesses(acornTree, 'file');
      t.deepEqual(result.length, 0);
    });

test(
    'getAccessesToGlobalProps should return pois when specific ' +
        'properties are accessed on the global object',
    async t => {
      const content1 = 'const f = global.Function;';
      const acornTree1 = parse(content1);
      const result1 = analysis.getAccessesToGlobalProps(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Access to global.Function');

      const content2 = 'global.require("http");';
      const acornTree2 = parse(content2);
      const result2 = analysis.getAccessesToGlobalProps(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Access to global.require');

      const content3 = 'f = global.eval(doSomethingBad());';
      const acornTree3 = parse(content3);
      const result3 = analysis.getAccessesToGlobalProps(acornTree3, 'file');
      t.deepEqual(result3.length, 1);
      t.deepEqual(result3[0].type, 'Access to global.eval');
    });

test(
    'getAccessesToGlobalProps should return pois obscured global objects',
    async t => {
      const content = 'const f = global;';
      const acornTree = parse(content);
      const result = analysis.getAccessesToGlobalProps(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Obfuscated global identifier');
    });

function parse(contents: string) {
  return acorn.parse(contents, {allowHashBang: true, locations: true});
}

test(
    'getFunctionClassAccesses should return POIs when there is a call ' +
        'to the Function constructor',
    async t => {
      const content1 = 'const a = new Function(\'a\', doSomethingBad);';
      const acornTree1 = parse(content1);
      const result1 = analysis.getFunctionClassAccesses(acornTree1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Function constructor usage');

      const content2 = 'const a = Function(\'a\', doSomethingBad);';
      const acornTree2 = parse(content2);
      const result2 = analysis.getFunctionClassAccesses(acornTree2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Function constructor usage');
    });

test(
    'getFunctionClassAccesses should return POIs when the properties ' +
        'of Function are being accessed',
    async t => {
      const content = 'const a = Function.prototype.call(require, \'http\');';
      const acornTree = parse(content);
      const result = analysis.getFunctionClassAccesses(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Access to a property of Function');
    });

test(
    'getFunctionClassAccesses should return POIs when Function ' +
        'is assigned to a variable',
    async t => {
      const content = 'const a = Function;';
      const acornTree = parse(content);
      const result = analysis.getFunctionClassAccesses(acornTree, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Obfuscated Function identifier');
    });
