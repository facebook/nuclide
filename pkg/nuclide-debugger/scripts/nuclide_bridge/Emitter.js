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

import WebInspector from '../../lib/WebInspector';

/**
 * Wrapper around `WebInspector.Object` to act like `atom.Emitter`.
 */
export default class Emitter {
  _underlying: WebInspector.Object;

  constructor() {
    this._underlying = new WebInspector.Object();
  }

  on(
    eventType: string,
    callback: (value?: any) => void,
  ): {dispose: () => void} {
    const listener = event => callback(event.data);
    this._underlying.addEventListener(eventType, listener);
    return {
      dispose: () => {
        this._underlying.removeEventListener(eventType, listener);
      },
    };
  }

  emit(eventType: string, value?: any): void {
    this._underlying.dispatchEventToListeners(eventType, value);
  }
}
