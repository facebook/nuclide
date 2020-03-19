/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/**
 * This implements polyfills for AbortSignal and AbortController
 * from the whatwg spec: https://dom.spec.whatwg.org/#aborting-ongoing-activities
 * These will become available in Chrome 66.
 */

// Shim of EventTarget usable in Node.
// Note that even in Chrome, EventTarget also isn't instantiable until version 64.
import {
  EventTarget as EventTargetShim,
  defineEventAttribute,
} from 'event-target-shim';

export class AbortSignal extends (EventTargetShim: typeof EventTarget) {
  aborted: boolean = false;
  // Defined via defineEventAttribute below.
  onabort: ?(event: Event) => mixed;

  // $FlowIssue: Computed properties are not supported
  get [Symbol.toStringTag]() {
    return 'AbortSignal';
  }
}

defineEventAttribute(AbortSignal.prototype, 'abort');

export default class AbortController {
  signal = new AbortSignal();

  abort() {
    // From whatwg spec, section 3.2:
    // If signal’s aborted flag is set, then return.
    if (this.signal.aborted) {
      return;
    }
    // Set signal’s aborted flag.
    this.signal.aborted = true;
    // Fire an event named abort at signal.
    // Note: event-target-shim converts objects to Events.
    this.signal.dispatchEvent(({type: 'abort'}: any));
  }

  // $FlowIssue: Computed properties are not supported
  get [Symbol.toStringTag]() {
    return 'AbortController';
  }
}
