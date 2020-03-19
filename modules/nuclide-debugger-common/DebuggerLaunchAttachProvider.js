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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebuggerConfigAction} from './types';
import * as React from 'react';

let uniqueKeySeed = 0;

export type callbacksForAction = {
  isEnabled: () => Promise<boolean>,
  getComponent: (
    debuggerTypeName: string,
    configIsValidChanged: (valid: boolean) => void,
    defaultConfig: ?{[string]: mixed},
  ) => ?React.Element<any>,
};

/**
 * Base class of all launch/attach providers.
 * It allows each concrete provider to provide customized debugging types, actions and UI.
 */
export default class DebuggerLaunchAttachProvider {
  _debuggingTypeName: string;
  _targetUri: NuclideUri;
  _uniqueKey: number;

  constructor(debuggingTypeName: string, targetUri: NuclideUri) {
    this._debuggingTypeName = debuggingTypeName;
    this._targetUri = targetUri;
    this._uniqueKey = uniqueKeySeed++;
  }

  getTabName(): string {
    return this._debuggingTypeName;
  }

  getCallbacksForAction(action: DebuggerConfigAction): callbacksForAction {
    return {
      /**
       * Whether this provider is enabled or not.
       */
      isEnabled: () => {
        return Promise.resolve(true);
      },

      /**
       * Returns the UI component for configuring the specified debugger type and action.
       */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
      ) => {
        throw new Error('abstract method');
      },
    };
  }

  /**
   * Returns target uri for this provider.
   */
  getTargetUri(): NuclideUri {
    return this._targetUri;
  }
}
