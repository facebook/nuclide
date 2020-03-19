/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebuggerConfigAction} from './types';
import type {LaunchAttachProviderIsEnabled, AutoGenConfig} from './types';

import invariant from 'assert';
import DebuggerLaunchAttachProvider from './DebuggerLaunchAttachProvider';
import * as React from 'react';
import AutoGenLaunchAttachUiComponent from './AutoGenLaunchAttachUiComponent';

const LaunchAttachProviderDefaultIsEnabled = (
  action: DebuggerConfigAction,
  config: AutoGenConfig,
) => {
  return Promise.resolve(config[action] != null);
};

export class AutoGenLaunchAttachProvider extends DebuggerLaunchAttachProvider {
  _config: AutoGenConfig;
  _isEnabled: LaunchAttachProviderIsEnabled;

  constructor(
    debuggingTypeName: string,
    targetUri: string,
    config: AutoGenConfig,
    isEnabled?: LaunchAttachProviderIsEnabled = LaunchAttachProviderDefaultIsEnabled,
  ) {
    super(debuggingTypeName, targetUri);
    this._config = config;
    this._isEnabled = isEnabled;
  }

  async _resolvePath(project: NuclideUri, filePath: string): Promise<string> {
    let rpcService: ?nuclide$RpcService = null;
    // Atom's service hub is synchronous.
    atom.packages.serviceHub
      .consume('nuclide-rpc-services', '0.0.0', provider => {
        rpcService = provider;
      })
      .dispose();
    if (rpcService != null) {
      const fsService = rpcService.getServiceByNuclideUri(
        'FileSystemService',
        project,
      );
      if (fsService != null) {
        try {
          return fsService.expandHomeDir(filePath);
        } catch (_) {}
      }
    }

    return Promise.resolve(filePath);
  }

  getCallbacksForAction(action: DebuggerConfigAction) {
    return {
      /**
       * Whether this provider is enabled or not.
       */
      isEnabled: async (): Promise<boolean> => {
        return this._isEnabled(action, this._config);
      },

      /**
       * Returns the UI component for configuring the specified debugger type and action.
       */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
        defaultConfig: ?{[string]: mixed},
      ) => {
        const launchOrAttachConfig = this._config[action];
        invariant(launchOrAttachConfig != null);
        if (defaultConfig != null) {
          launchOrAttachConfig.properties = launchOrAttachConfig.properties.map(
            p => ({
              ...p,
              defaultValue:
                defaultConfig[p.name] == null
                  ? p.defaultValue
                  : defaultConfig[p.name],
            }),
          );

          // Pass the ignore flag from the properites to the LaunchOrAttachConfigBase
          if (defaultConfig.ignorePreviousParams !== undefined) {
            launchOrAttachConfig.ignorePreviousParams = Boolean(
              defaultConfig.ignorePreviousParams,
            );
          } else {
            launchOrAttachConfig.ignorePreviousParams = false;
          }
        }

        return (
          <AutoGenLaunchAttachUiComponent
            targetUri={this.getTargetUri()}
            configIsValidChanged={configIsValidChanged}
            config={launchOrAttachConfig}
            debuggerTypeName={debuggerTypeName}
            pathResolver={this._resolvePath}
          />
        );
      },
    };
  }
}
