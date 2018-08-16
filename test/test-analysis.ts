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

import test from 'ava';
import * as analysis from '../src/analysis';

test(
    'getIOModules should detect http module in standard require http case',
    async t => {
      const content = 'const a = require(\'http\');';
      const result = analysis.getIOModules(content, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'http');
    });

test(
    'getIOModules should not detect http module when there are no ' +
        'require calls',
    async t => {
      const content1 = 'console.log(\'http\')';
      const result1 = analysis.getIOModules(content1, 'file');
      t.deepEqual(result1.length, 0);

      const content2 = 'const a = \'require(\\\'http\\\')\';';
      const result2 = analysis.getIOModules(content2, 'file');
      t.deepEqual(result2.length, 0);
    });

test('getIOModules should not detect contain util modules', async t => {
  const content = 'const a = require(\'util\');\nconst b = require(\'path\');';
  const result = analysis.getIOModules(content, 'file');
  t.deepEqual(result.length, 0);
});

test(
    'getIOModules should detect http module when require arg in ' +
        'template literals',
    async t => {
      const content1 = 'const a = require(`${\'http\'}`);';
      const result1 = analysis.getIOModules(content1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'http');

      const content2 = 'const a = require(`http`);';
      const result2 = analysis.getIOModules(content2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'http');
    });

test('getIOModules should detect both http and fs module', async t => {
  const content =
      'const a = require(\'http\');\n const b = require(`${\'fs\'}`);';
  const result = analysis.getIOModules(content, 'file');
  t.deepEqual(result.length, 2);
  t.deepEqual(result[0].type, 'http');
  t.deepEqual(result[1].type, 'fs');
});

test(
    'getDynamicEval should detect concatenation of strings that forms http ' +
        'as a dyanmic require arg',
    async t => {
      const content = 'const a = require(\'h\' + \'t\' + \'t\' + \'p\');';
      const result = analysis.getDynamicEval(content, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Arg');
    });

test(
    'getDynamicEval should detect substring that forms http as a dynamic ' +
        'require arg',
    async t => {
      const content1 =
          `const a = \'anotherhttp\'\nconst b = require(a.substring(6));`;
      const result1 = analysis.getDynamicEval(content1, 'file');
      t.deepEqual(result1.length, 1);
      t.deepEqual(result1[0].type, 'Dynamic Require Arg');

      const content2 = 'const a = require(\'anotherhttp\'.substring(6))';
      const result2 = analysis.getDynamicEval(content2, 'file');
      t.deepEqual(result2.length, 1);
      t.deepEqual(result2[0].type, 'Dynamic Require Arg');
    });

test(
    'getDynamicEval should detect function that returns http as a ' +
        'dynamic require arg',
    async t => {
      const content =
          'function returnHttp(){return \'http\';}\nconst a = require(returnHttp);';
      const result = analysis.getDynamicEval(content, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Arg');
    });

test(
    'getDynamicEval should detect if require callee is defined as a variable',
    async t => {
      const content = `function something(){ return 1;}
                        const a = require; 
                        const b = a(\'https\');`;
      const result = analysis.getDynamicEval(content, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Call');
    });

test(
    'getDynamicEval should detect if require identifier is ' +
        'returned in a function',
    async t => {
      const content =
          'function returnRequire(){return require;}\n const a = returnRequire();\nconst b = a(\'http\');';
      const result = analysis.getDynamicEval(content, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Call');
    });

test(
    'getDynamicEval should detect if require identifier is passed as a ' +
        'parameter in a function',
    async t => {
      const content =
          'function f(a, b){return a(b)}\nconst a = f(require, \'http\');';
      const result = analysis.getDynamicEval(content, 'file');
      t.deepEqual(result.length, 1);
      t.deepEqual(result[0].type, 'Dynamic Require Call');
    });

test(
    'when there is a syntax error in a file, getSyntaxError should return ' +
        'a syntax poi',
    async t => {
      const content = 'const s = \'';
      const result = analysis.getSyntaxError(content, 'file');
      t.notDeepEqual(result, undefined);
      t.deepEqual(result!.type, 'Syntax Error');
    });

test(
    'when there is no syntax errors in a file, getSyntaxError should ' +
        'not return a poi',
    async t => {
      const content = 'const s = \'string\'';
      const result = analysis.getSyntaxError(content, 'file');
      t.deepEqual(result, undefined);
    });
