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
  DebuggerCapabilities,
  DebuggerProperties,
  DebuggerInstanceBase,
} from '../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  LaunchTargetInfo,
  DebuggerConfig,
  NativeDebuggerService as NativeDebuggerServiceType,
} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import type RemoteControlService from '../../nuclide-debugger/lib/RemoteControlService';
import typeof * as NativeDebuggerService from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import type {PausedEvent} from '../../nuclide-debugger-base/lib/protocol-types';

import invariant from 'assert';
import {
  DebuggerProcessInfo,
  registerConsoleLogging,
} from '../../nuclide-debugger-base';
import {DebuggerInstance} from '../../nuclide-debugger-base';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getConfig} from './utils';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import nullthrows from 'nullthrows';
import passesGK from '../../commons-node/passesGK';

export class LaunchProcessInfo extends DebuggerProcessInfo {
  _launchTargetInfo: LaunchTargetInfo;
  _shouldFilterBreaks: boolean;

  constructor(targetUri: NuclideUri, launchTargetInfo: LaunchTargetInfo) {
    super('lldb', targetUri);
    this._launchTargetInfo = launchTargetInfo;
    this._shouldFilterBreaks = false;
  }

  clone(): LaunchProcessInfo {
    return new LaunchProcessInfo(this._targetUri, this._launchTargetInfo);
  }

  getDebuggerCapabilities(): DebuggerCapabilities {
    return {
      ...super.getDebuggerCapabilities(),
      conditionalBreakpoints: true,
      continueToLocation: true,
      disassembly: true,
      readOnlyTarget:
        this._launchTargetInfo.coreDump != null &&
        this._launchTargetInfo.coreDump !== '',
      registers: true,
      singleThreadStepping: true,
      threads: true,
    };
  }

  getDebuggerProps(): DebuggerProperties {
    return super.getDebuggerProps();
  }

  shouldFilterBreak(pausedEvent: PausedEvent): boolean {
    if (this._shouldFilterBreaks) {
      // When starting a process in the terminal, we expect a couple additional
      // startup breaks that should be filtered out and hidden from the user.
      // There will be a signal break for the exec system call, and often a
      // signal for the terminal resize event.
      const {reason} = pausedEvent;
      if (reason === 'exec' || reason === 'signal') {
        return true;
      }

      // Once a real breakpoint is seen, remaining breaks should be unfiltered.
      this._shouldFilterBreaks = false;
    }

    return false;
  }

  async _launchInTerminal(
    rpcService: NativeDebuggerServiceType,
    remoteService: RemoteControlService,
  ): Promise<boolean> {
    // Enable filtering on the first few breaks, when lanuching in the terminal
    // we expect to see additional startup breaks due to signals sent by execing
    // the child process.
    this._shouldFilterBreaks = true;

    // Build a map of environment variables specified in the launch target info.
    const environmentVariables = new Map();
    this._launchTargetInfo.environmentVariables.forEach(variable => {
      const [key, value] = variable.split('=');
      environmentVariables.set(key, value);
    });

    // Instruct the native debugger backend to prepare to launch in the terminal.
    // It will return the command and args to launch in the remote terminal.
    const terminalLaunchInfo = await rpcService.prepareForTerminalLaunch(
      this._launchTargetInfo,
    );

    const {
      targetExecutable,
      launchCwd,
      launchCommand,
      launchArgs,
    } = terminalLaunchInfo;

    // In the terminal, launch the command with the arguments specified by the
    // debugger back end.
    // Note: this returns true on a successful launch, false otherwise.
    return remoteService.launchDebugTargetInTerminal(
      targetExecutable,
      launchCommand,
      launchArgs,
      launchCwd,
      environmentVariables,
    );
  }

  async debug(): Promise<DebuggerInstanceBase> {
    const rpcService = this._getRpcService();
    const remoteService = nullthrows(
      await consumeFirstProvider('nuclide-debugger.remote'),
    );

    if (typeof this.basepath === 'string') {
      this._launchTargetInfo.basepath = this.basepath;
    }

    let debugSession = null;
    let outputDisposable = registerConsoleLogging(
      'LLDB',
      rpcService.getOutputWindowObservable().refCount(),
    );
    try {
      // Attempt to launch into a terminal if it is supported.
      let launched = false;
      if (
        remoteService.canLaunchDebugTargetInTerminal(this._targetUri) &&
        getConfig().useTerminal &&
        (await passesGK('nuclide_debugger_launch_in_terminal'))
      ) {
        launched = await this._launchInTerminal(rpcService, remoteService);
      }

      // Otherwise, fall back to launching without a terminal.
      if (!launched) {
        await rpcService
          .launch(this._launchTargetInfo)
          .refCount()
          .toPromise();
      }

      // Start websocket server with Chrome after launch completed.
      invariant(outputDisposable);
      debugSession = new DebuggerInstance(
        this,
        rpcService,
        new UniversalDisposable(outputDisposable),
      );
      outputDisposable = null;
    } finally {
      if (outputDisposable != null) {
        outputDisposable.dispose();
      }
    }
    return debugSession;
  }

  getDebuggerConfig(): DebuggerConfig {
    return {
      logLevel: getConfig().serverLogLevel,
      pythonBinaryPath: getConfig().pythonBinaryPath,
      buckConfigRootFile: getConfig().buckConfigRootFile,
      lldbPythonPath:
        // flowlint-next-line sketchy-null-string:off
        this._launchTargetInfo.lldbPythonPath || getConfig().lldbPythonPath,
      envPythonPath: '',
    };
  }

  _getRpcService(): NativeDebuggerServiceType {
    const debuggerConfig = this.getDebuggerConfig();
    const service: ?NativeDebuggerService = getServiceByNuclideUri(
      'NativeDebuggerService',
      this.getTargetUri(),
    );
    invariant(service);
    return new service.NativeDebuggerService(debuggerConfig);
  }
}
