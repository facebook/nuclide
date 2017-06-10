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

import type {DebuggerConfigAction} from '../../../nuclide-debugger-base';

import {DebuggerLaunchAttachProvider} from '../../../nuclide-debugger-base';
import {DebugUiComponent} from './DebugUiComponent';
import invariant from 'assert';
import React from 'react';

export class ReactNativeLaunchAttachProvider
  extends DebuggerLaunchAttachProvider {
  getCallbacksForAction(action: DebuggerConfigAction) {
    return {
      /**
         * Whether this provider is enabled or not.
         */
      isEnabled: () => {
        return Promise.resolve(action === 'attach');
      },

      /**
         * Returns a list of supported debugger types + environments for the specified action.
         */
      getDebuggerTypeNames: super.getCallbacksForAction(action)
        .getDebuggerTypeNames,

      /**
         * Returns the UI component for configuring the specified debugger type and action.
         */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
      ) => {
        invariant(action === 'attach');
        return (
          <DebugUiComponent
            targetUri={this.getTargetUri()}
            configIsValidChanged={configIsValidChanged}
          />
        );
      },
    };
  }

  dispose(): void {}
}
