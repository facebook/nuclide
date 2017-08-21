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
  AttachTargetInfo,
  NativeDebuggerService as NativeDebuggerServiceType,
} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';

import {
  DebuggerProcessInfo,
  registerConsoleLogging,
} from '../../nuclide-debugger-base';
import invariant from 'assert';
import {DebuggerInstance} from '../../nuclide-debugger-base';
import {getConfig} from './utils';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export class AttachProcessInfo extends DebuggerProcessInfo {
  _targetInfo: AttachTargetInfo;

  constructor(targetUri: NuclideUri, targetInfo: AttachTargetInfo) {
    super('lldb', targetUri);
    this._targetInfo = targetInfo;
  }

  clone(): AttachProcessInfo {
    return new AttachProcessInfo(this._targetUri, this._targetInfo);
  }

  getDebuggerCapabilities(): DebuggerCapabilities {
    return {
      ...super.getDebuggerCapabilities(),
      conditionalBreakpoints: true,
      continueToLocation: true,
      singleThreadStepping: true,
      threads: true,
    };
  }

  getDebuggerProps(): DebuggerProperties {
    return super.getDebuggerProps();
  }

  async debug(): Promise<DebuggerInstanceBase> {
    const rpcService = this._getRpcService();
    let debugSession = null;
    let outputDisposable = registerConsoleLogging(
      'LLDB',
      rpcService.getOutputWindowObservable().refCount(),
    );
    try {
      await rpcService.attach(this._targetInfo).refCount().toPromise();
      // Start websocket server with Chrome after attach completed.
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

  _getRpcService(): NativeDebuggerServiceType {
    const debuggerConfig = {
      logLevel: getConfig().serverLogLevel,
      pythonBinaryPath: getConfig().pythonBinaryPath,
      buckConfigRootFile: getConfig().buckConfigRootFile,
      lldbPythonPath: getConfig().lldbPythonPath,
      envPythonPath: '',
    };
    const service = getServiceByNuclideUri(
      'NativeDebuggerService',
      this.getTargetUri(),
    );
    invariant(service);
    return new service.NativeDebuggerService(debuggerConfig);
  }
}
