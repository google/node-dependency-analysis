import test from 'ava';
import * as search from '../src/search';

test(
    'searchValue should have http module in standard require ' + 
        'http case',
    async t => {
      const content = 'const a = require(\'http\');';
      const result = await search.search(content);
      t.true(result.requiredModules.has('http'));
    });

test(
    'searchValue should not have http module when there are no require calls',
    async t => {
      const content1 = 'console.log(\'http\')';
      const result1 = await search.search(content1);
      t.deepEqual(result1.requiredModules.size, 0);

      const content2 = 'const a = \'require(\\\'http\\\')\';';
      const result2 = await search.search(content2);
      t.deepEqual(result2.dynamicArgs.length, 0);
      t.deepEqual(result2.requiredModules.size, 0);
    });

test('searchValue should not contain util modules', async t => {
  const content = 'const a = require(\'util\');\nconst b = require(\'path\');';
  const result = await search.search(content);
  t.deepEqual(result.requiredModules.size, 0);
});

test(
    'searchValue should have http module when require arg in template literals',
    async t => {
      const content1 = 'const a = require(`${\'http\'}`);';
      const result1 = await search.search(content1);
      t.true(result1.requiredModules.has('http'));

      const content2 = 'const a = require(`http`);';
      const result2 = await search.search(content2);
      t.true(result2.requiredModules.has('http'));
    });

test('searchValue should have http and fs module', async t => {
  const content =
      'const a = require(\'http\');\n const b = require(`${\'fs\'}`);';
  const result = await search.search(content);
  t.true(result.requiredModules.has('http'));
  t.true(result.requiredModules.has('fs'));
});

test('line number is accurate for search', async t => {
  const content =
      'const a = require(\'http\');\n const b = require(`${\'fs\'}`);';
  const result = await search.search(content);

  const httpPosition = (result.requiredModules.get('http'));
  t.true(!!httpPosition);
  t.deepEqual(httpPosition!.lineStart, 1);

  const fsPosition = (result.requiredModules.get('fs'));
  t.true(!!fsPosition);
  t.deepEqual(fsPosition!.lineStart, 2);
});

test(
    'search function should return correct dynamic arg position with ' + 
        'require arg as a concatenation of strings that forms http',
    async t => {
      const content = 'const a = require(\'h\' + \'t\' + \'t\' + \'p\');';
      const result = await search.search(content);
      t.deepEqual(result.dynamicArgs[0].lineStart, 1);
    });

test(
    'search function should return correct dynamic arg position with ' + 
        'require arg as a substring that forms http',
    async t => {
      const content1 =
          `const a = \'anotherhttp\'\nconst b = require(a.substring(6));`;
      const result1 = await search.search(content1);
      t.deepEqual(result1.dynamicArgs[0].lineStart, 2);

      const content2 = 'const a = require(\'anotherhttp\'.substring(6))';
      const result2 = await search.search(content2);
      t.deepEqual(result2.dynamicArgs[0].lineStart, 1);
    });

test(
    'search function should return correct dynamic arg position with ' + 
        'require arg as a function that returns http',
    async t => {
      const content =
          'function returnHttp(){return \'http\';}\nconst a = require(returnHttp);';
      const result = await search.search(content);
      t.deepEqual(result.dynamicArgs[0].lineStart, 2);
    });

test(
    'search function should return dynamic require position where require callee ' + 
        'is defined as a variable',
    async t => {
      const content1 = `function something(){ return 1;}
                        const a = require; 
                        const b = a(\'https\');`;
      const result1 = await search.search(content1);
      t.deepEqual(result1.dynamicRequire[0].lineStart, 2);
    });

test(
    'search function should return correct dynamic arg position where require ' + 
        'identifier is returned in a function',
    async t => {
      const content =
          'function returnRequire(){return require;}\n const a = returnRequire();\nconst b = a(\'http\');';
      const result = await search.search(content);
      t.deepEqual(result.dynamicRequire[0].lineStart, 1);
    });

test(
    'search function should return correct dynamic arg position where require ' + 
        'identifier is passed as a parameter in a function',
    async t => {
      const content =
          'function f(a, b){return a(b)}\nconst a = f(require, \'http\');';
      const result = await search.search(content);
      t.deepEqual(result.dynamicRequire[0].lineStart, 2);
    });
