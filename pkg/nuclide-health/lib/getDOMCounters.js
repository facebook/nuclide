/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import invariant from 'assert';
import {remote} from 'electron';
import {getLogger} from 'log4js';

invariant(remote != null, 'Must be run from renderer');

/**
 * Documented at:
 * https://chromedevtools.github.io/devtools-protocol/tot/Memory/#method-getDOMCounters
 */

export type DOMCounters = {
  nodes: number,
  attachedNodes: number,
  jsEventListeners: number,
};

export default (async function getDOMCounters(): Promise<?DOMCounters> {
  const chromeDebugger = remote.getCurrentWebContents().debugger;
  if (chromeDebugger == null) {
    return null;
  }
  try {
    chromeDebugger.attach('1.1');
    return await new Promise(resolve => {
      chromeDebugger.sendCommand('Memory.getDOMCounters', {}, (err, result) => {
        // Oddly, err is an Object even if there is no error.
        // We'll resort to checking that result is a valid DOMCounter type.
        if (
          result != null &&
          typeof result.nodes === 'number' &&
          typeof result.jsEventListeners === 'number'
        ) {
          resolve({
            nodes: result.nodes,
            jsEventListeners: result.jsEventListeners,
            // While not cheap, this isn't more expensive than the debugger calls.
            attachedNodes: document.querySelectorAll('*').length,
          });
        } else {
          getLogger().warn('Error from Memory.getDOMCounters', err);
          resolve(null);
        }
      });
    });
  } catch (e) {
    // The debugger is likely already attached.
    return null;
  } finally {
    chromeDebugger.detach();
  }
});
