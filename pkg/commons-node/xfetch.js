/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

/**
 * `xfetch` (cross fetch) is just like `isomorphic-fetch`, but it doesn't
 * pollute the global scope and it's correctly flow typed.
 *
 * `fetch` is a web API available in Electron. `node-fetch` is a mostly
 * compatible polyfill for Node. Although `fetch` is more limited than the
 * `request` library, it's much lighter to load and it's easier to debug because
 * connections are visible in the devtools Network Panel. For our purposes, it's
 * good enough.
 *
 * Differences between the native fetch and the polyfill:
 * https://github.com/bitinn/node-fetch/blob/master/LIMITS.md
 */

/**
 * A note on errors:
 * A fetch() promise will reject with a TypeError when a network error is
 * encountered, although this usually means permission issues or similar — a
 * 404 does not constitute a network error, for example. An accurate check for
 * a successful fetch() would include checking that the promise resolved, then
 * checking that the Response.ok property has a value of true.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
 */

// The `fetch` function is directly exported (no wrapper) so that this module
// doesn't create a frame in stack traces. Also, so the "initiator" in the
// Network Panel reflects the actual `fetch` call site and not this module.
// The export is typed with `typeof fetch` so flow treats the polyfill as the
// real `fetch`.

import {isRunningInTest} from './system-info';
import nodeFetch from 'node-fetch';

// Stub out `fetch` in all tests so we don't inadvertently rely on external URLs.
const testFetch: typeof fetch = function testFetch() {
  return Promise.reject(
    Error('fetch is stubbed out for testing. Use a spy instead.'),
  );
};

const fetchImpl =
  typeof global.fetch === 'function' ? global.fetch : (nodeFetch: typeof fetch);

export default (isRunningInTest() ? testFetch : fetchImpl);
