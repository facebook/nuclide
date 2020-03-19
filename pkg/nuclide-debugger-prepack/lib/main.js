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

import type {
  AutoGenConfig,
  AutoGenLaunchConfig,
  NuclideDebuggerProvider,
} from 'nuclide-debugger-common/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {VsAdapterTypes, VsAdapterNames} from 'nuclide-debugger-common';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';

import type {
  DeepLinkService,
  DeepLinkParams,
} from '../../nuclide-deep-link/lib/types';

class Activation {
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable();
  }

  createDebuggerProvider(): NuclideDebuggerProvider {
    return {
      type: VsAdapterTypes.PREPACK,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.PREPACK,
          connection,
          getPrepackAutoGenConfig(),
        );
      },
    };
  }

  consumeDeepLinkService(service: DeepLinkService): IDisposable {
    const disposable = service.subscribeToPath(
      'prepack-debugger',
      (params: DeepLinkParams) => {
        const debugDialogConfig = {};
        // Note: single element arrays are passed as strings.
        // Arrays in the config must be treated as whitespace separated strings.
        // The following cleans up both of the above cases.
        debugDialogConfig.sourceFiles = Array.isArray(params.sourceFiles)
          ? params.sourceFiles.join(' ')
          : params.sourceFiles;

        // Prepack Arguments are optional
        if (params.prepackArguments) {
          debugDialogConfig.prepackArguments = Array.isArray(
            params.prepackArguments,
          )
            ? params.prepackArguments.join(' ')
            : params.prepackArguments;
        } else {
          debugDialogConfig.prepackArguments = '';
        }

        debugDialogConfig.prepackRuntime = params.prepackRuntime
          ? params.prepackRuntime
          : '';

        debugDialogConfig.ignorePreviousParams = true;
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'debugger:show-launch-dialog',
          {
            selectedTabName: VsAdapterNames.PREPACK,
            config: debugDialogConfig,
          },
        );
      },
    );
    this._subscriptions.add(disposable);
    return disposable;
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

export function getPrepackAutoGenConfig(): AutoGenConfig {
  const filesToPrepack = {
    name: 'sourceFiles',
    type: 'array',
    itemType: 'string',
    description: 'Input the file(s) you want to Prepack. Use absolute paths.',
    required: true,
    defaultValue: '',
    visible: true,
  };
  const prepackRuntimePath = {
    name: 'prepackRuntime',
    type: 'string',
    description:
      'Prepack executable path (e.g. lib/prepack-cli.js). Use absolute paths.',
    required: false,
    visible: true,
  };
  const argumentsProperty = {
    name: 'prepackArguments',
    type: 'array',
    itemType: 'string',
    description: 'Arguments to start Prepack',
    required: false,
    defaultValue: '',
    visible: true,
  };

  const autoGenLaunchConfig: AutoGenLaunchConfig = {
    launch: true,
    vsAdapterType: VsAdapterTypes.PREPACK,
    properties: [filesToPrepack, prepackRuntimePath, argumentsProperty],
    scriptPropertyName: 'filesToPrepack',
    scriptExtension: '.js',
    cwdPropertyName: null,
    header: null,
    getProcessName(values) {
      return 'Prepack (Debugging)';
    },
  };
  return {
    launch: autoGenLaunchConfig,
    attach: null,
  };
}

createPackage(module.exports, Activation);
