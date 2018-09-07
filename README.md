# Node.js Dependency Analysis

[![npm version](https://badge.fury.io/js/gnash.svg)](https://badge.fury.io/js/gnash)

> I have 1000 dependencies in my Node project and I don't know what they're doing... how can I know more?

**G**oogle's **N**ode **A**nalysis tool **s**hould **h**elp!

Many Node.js projects have large package dependency trees with total transitive dependencies numbering in the hundreds, written by many authors. This tool helps developers more easily audit these dependencies through static analysis, with a focus on highlighting instances of I/O and dynamic execution, as well as patterns that obfuscate these instances. We operate under the assumption that a small number of modules exhibit these behaviors, and provide a summary of the dependency tree that not only assists developers in auditing their code, but also allows users to compare the sensitive functionality of third-party code across new installations and dependency upgrades at a glance.

## Detected Patterns

* Loading Core I/O Modules
```js
// load http, to make network requests.
require('http');

// load fs, to read/write files.
require('fs');
```

* Dynamic Arguments to Require
```js
// loads http, but obfuscates the input to require() by computing it at runtime.
require('ht' + 'tp');

// loads fs, but obfuscates the input to require() by assigning it to another variable first.
const myStr = 'fs';
require(myStr);
```

* Arbitrary Expression Evaluation
```js
// evaluates doBadThings().
eval('doBadThings();');

// creates a function that evaluates doBadThings(), and runs it.
const fn = new Function('return doBadThings();');
fn();

// evaluates doBadThings(), similar to eval (but with a Node API).
vm.runInNewContext('doBadThings();');
```

* Module-Loading Internals
```js
// uses a function used internally in require() to load https.
Module._load('https');

// overrides the internal function so that require('foo') returns require('http').
const oldLoad = Module._load;
Module = { _load(str) { return str === 'foo' ? oldLoad('http') :oldLoad(str); } }
```

* Assigning Sensitive Functions to Other Variables
```js
// re-assigns require() to be called somewhere else.
const r = require;
r('https');

// passes require to a function that will invoke it.
Function.prototype.call(require, 'https');
```

* Accessing Sensitive Functions on `global`
```js
// indexes into global to get a reference to eval().
global['eval']('doBadThings()');

// Accesses require on global rather than the module-local version.
global.require('https');
```

* Accessing Environment Variables
```js
// passes the user's NPM_TOKEN env var to doBadThings().
doBadThings(process.env.NPM_TOKEN);

// enumerates thru env vars and passes them to doBadThings.
doBadThings(Object.keys(process['env']).map(k => process['env'][k]));
```

* Unorthodox Function Calls
```js
// same as `require('http')`.
require.call(null, 'http');

// also same as `require('http')`. (this gets picked up in other detections)
Function.prototype.call(require, 'http');
```

## Distinguishing between Legitimate and Illegitimate Use Cases

Every scenario in the above-listed procedures has legitimate use cases; clearly, simply requiring a module that does I/O is not grounds to condemn it as malicious. Even “attempts” to obfuscate code can be benign; this might result from webpacking/minimization, or be a feature of a module designed to monkeypatch Node APIs for monitoring reasons.

However, it still stands that each module that invokes one of these scenarios should have an articulable reason, and the user should set a higher bar to trust these modules. For example, request is a widely-used and legitimate module that makes http requests, being a convenience wrapper around the http module. Because of this, the author of request bears a responsibility to convince their users that they are putting forth their best effort to protect their publish credentials.

There are a few different ways for users to distinguish between legitimate and illegitimate use cases:

### Changes Across Versions

Compare across several versions of a module, or a dependency tree, for changes in detected patterns. This can be done upon the installation of a new module, or just simply upon every installation.

### Whitelisting

Maintain a whitelist that allows certain modules to exhibit these patterns. As explained above, this means that we trust certain modules more than others; the hypothesis here (that needs to be tested) is that the number of modules that exhibit legitimate uses of each pattern is low (relative to the total number of modules).

### Dynamic Analysis
Run a closely associated dynamic analysis tool during runtime that compares actual behavior of an application with the list of detected patterns, and have it report anomalies.

