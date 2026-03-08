'use strict';

// Node 25 exposes `localStorage` as a built-in global getter that throws a
// SecurityError unless --localstorage-file is set. Jest 30's environment
// eagerly proxies every globalThis property (including localStorage), which
// triggers the error before any test code runs. Patching it to a plain value
// here — before jest-environment-node is required and builds its globals map —
// keeps it inert for the lifetime of each worker process.
const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
if (desc && desc.get) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: desc.enumerable,
    value: undefined,
    writable: true,
  });
}

const { TestEnvironment } = require('jest-environment-node');
module.exports = TestEnvironment;
