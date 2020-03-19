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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  DebuggerConfigAction,
  ControlButtonSpecification,
  IProcessConfig,
  IVspInstance,
} from 'nuclide-debugger-common';
import type {
  HHVMLaunchConfig,
  HHVMAttachConfig,
} from '../../nuclide-debugger-hhvm-rpc';
import {getDebuggerService} from 'nuclide-commons-atom/debugger';
import featureConfig from 'nuclide-commons-atom/feature-config';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {shellParse} from 'nuclide-commons/string';
import {
  DebuggerLaunchAttachProvider,
  VsAdapterTypes,
} from 'nuclide-debugger-common';
import * as React from 'react';
import {LaunchUiComponent} from './HhvmLaunchUiComponent';
import {AttachUiComponent} from './HhvmAttachUiComponent';
import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type PhpDebuggerSessionConfig = {
  hhvmRuntimeArgs: string,
  hhvmRuntimePath: string,
  hhvmServerAttachPort: number,
};

function getCustomControlButtons(): Array<ControlButtonSpecification> {
  const customControlButtons = [
    {
      icon: 'link-external',
      title: 'Toggle HTTP Request Sender',
      onClick: () =>
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'nuclide-http-request-sender:toggle-http-request-edit-dialog',
        ),
    },
  ];

  try {
    return customControlButtons.concat(
      // $FlowFB
      require('./fb-HhvmServices').customControlButtons,
    );
  } catch (_) {
    return customControlButtons;
  }
}

export default class HhvmLaunchAttachProvider extends DebuggerLaunchAttachProvider {
  constructor(debuggingTypeName: string, targetUri: string) {
    super(debuggingTypeName, targetUri);
  }

  getCallbacksForAction(action: DebuggerConfigAction) {
    return {
      /**
       * Whether this provider is enabled or not.
       */
      isEnabled: (): Promise<boolean> => {
        return Promise.resolve(
          nuclideUri.isRemote(this.getTargetUri()) ||
            process.platform !== 'win32',
        );
      },

      /**
       * Returns the UI component for configuring the specified debugger type and action.
       */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
      ) => {
        if (action === 'launch') {
          return (
            <LaunchUiComponent
              targetUri={this.getTargetUri()}
              configIsValidChanged={configIsValidChanged}
              getLaunchProcessConfig={getLaunchProcessConfig}
            />
          );
        } else if (action === 'attach') {
          return (
            <AttachUiComponent
              targetUri={this.getTargetUri()}
              configIsValidChanged={configIsValidChanged}
              startAttachProcessConfig={startAttachProcessConfig}
            />
          );
        } else {
          invariant(false, 'Unrecognized action for component.');
        }
      },
    };
  }
}

function getConfig(): PhpDebuggerSessionConfig {
  return (featureConfig.get('nuclide-debugger-php'): any);
}

// Determines the debug configuration for launching the HHVM debugger
function _getHHVMLaunchConfig(
  targetUri: NuclideUri,
  scriptPath: string,
  scriptArgs: string,
  scriptWrapperCommand: ?string,
  runInTerminal: boolean,
  cwdPath: string,
): HHVMLaunchConfig {
  const userConfig = getConfig();
  const deferLaunch = runInTerminal;

  // Honor any PHP configuration the user has in Nuclide settings.
  const phpRuntimePath =
    userConfig.hhvmRuntimePath != null
      ? String(userConfig.hhvmRuntimePath)
      : null;
  const hhvmRuntimeArgs = shellParse(
    userConfig.hhvmRuntimeArgs != null
      ? String(userConfig.hhvmRuntimeArgs)
      : '',
  );

  const config: HHVMLaunchConfig = {
    targetUri: nuclideUri.getPath(targetUri),
    action: 'launch',
    launchScriptPath: scriptPath,
    scriptArgs: shellParse(scriptArgs),
    hhvmRuntimeArgs,
    deferLaunch,
  };

  if (cwdPath != null && cwdPath !== '') {
    config.cwd = cwdPath;
  }

  if (phpRuntimePath != null) {
    config.hhvmRuntimePath = phpRuntimePath;
  }

  if (scriptWrapperCommand != null) {
    config.launchWrapperCommand = scriptWrapperCommand;
  }

  return config;
}

export function getLaunchProcessConfig(
  targetUri: NuclideUri,
  scriptPath: string,
  scriptArgs: string,
  scriptWrapperCommand: ?string,
  runInTerminal: boolean,
  cwdPath: string,
): IProcessConfig {
  const config = _getHHVMLaunchConfig(
    targetUri,
    scriptPath,
    scriptArgs,
    scriptWrapperCommand,
    runInTerminal,
    cwdPath,
  );
  return {
    targetUri,
    debugMode: 'launch',
    isRestartable: true,
    adapterType: VsAdapterTypes.HHVM,
    grammarName: 'source.hackfragment',
    config: {
      ...config,
    },
    processName: `HHVM (${nuclideUri.basename(scriptPath)})`,
    servicedFileExtensions: ['php', 'hh'],
  };
}

function _getHHVMAttachConfig(
  targetUri: NuclideUri,
  attachPort: ?number,
): HHVMAttachConfig {
  // Note: not specifying startup document or debug port here, the backend
  // will use the default parameters. We can surface these options in the
  // Attach Dialog if users need to be able to customize them in the future.
  const config: HHVMAttachConfig = {
    targetUri: nuclideUri.getPath(targetUri),
    action: 'attach',
  };

  // If attach port is not specified by the caller, see if one is specified
  // in Nuclide configuration.
  if (attachPort == null) {
    const userConfig = getConfig();
    if (userConfig.hhvmServerAttachPort !== '') {
      const userPort = parseInt(userConfig.hhvmServerAttachPort, 10);
      if (!Number.isNaN(userPort)) {
        config.debugPort = userPort;
      }
    }
  } else {
    config.debugPort = attachPort;
  }

  return config;
}

export async function startAttachProcessConfig(
  targetUri: NuclideUri,
  attachPort: ?number,
  serverAttach: boolean,
): Promise<void> {
  const config = _getHHVMAttachConfig(targetUri, attachPort);
  const processConfig = {
    targetUri,
    debugMode: 'attach',
    adapterType: VsAdapterTypes.HHVM,
    processName: `HHVM (${
      serverAttach
        ? nuclideUri.isRemote(targetUri)
          ? nuclideUri.getHostname(targetUri)
          : 'localhost'
        : 'Attached to script on port ' + (attachPort || 0)
    })`,
    grammarName: 'source.hackfragment',
    config: {
      ...config,
    },
    customControlButtons: getCustomControlButtons(),
    servicedFileExtensions: ['php', 'hh'],
    isRestartable: true,
    onDebugStartingCallback: (instance: IVspInstance) => {
      // This IDisposable will be disposed when the debugging session ends.
      // The debug service will ensure it is called on our behalf.
      const disposables = new UniversalDisposable();
      try {
        // $FlowFB
        const services = require('./fb-HhvmServices');

        services.startSlog();
        disposables.add(() => {
          services.stopSlog();
        });

        if (serverAttach) {
          services.startCrashHandler(
            targetUri,
            processConfig,
            startAttachProcessConfig,
            instance,
          );
          disposables.add(() => {
            services.stopCrashHandler(processConfig);
          });
        }
      } catch (_) {}

      return disposables;
    },
  };

  const debugService = await getDebuggerService();
  debugService.startVspDebugging(processConfig);
}
