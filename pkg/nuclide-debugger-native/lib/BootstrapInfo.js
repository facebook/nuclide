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

import type {DebuggerInstanceBase} from '../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  BootstrapDebuggerInfo,
  DebuggerConfig,
  NativeDebuggerService as NativeDebuggerServiceType,
} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import typeof * as NativeDebuggerService
  from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';

import invariant from 'assert';
import {
  DebuggerProcessInfo,
  registerConsoleLogging,
} from '../../nuclide-debugger-base';
import {DebuggerInstance} from '../../nuclide-debugger-base';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getConfig} from './utils';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export class BootstrapInfo extends DebuggerProcessInfo {
  _bootstrapInfo: BootstrapDebuggerInfo;

  constructor(targetUri: NuclideUri, bootstrapInfo: BootstrapDebuggerInfo) {
    super('lldb', targetUri);
    this._bootstrapInfo = bootstrapInfo;
  }

  clone(): BootstrapInfo {
    return new BootstrapInfo(this._targetUri, this._bootstrapInfo);
  }

  supportThreads(): boolean {
    return true;
  }

  async debug(): Promise<DebuggerInstanceBase> {
    const rpcService = this._getRpcService();
    let debugSession = null;
    let outputDisposable = registerConsoleLogging(
      'LLDB',
      rpcService.getOutputWindowObservable().refCount(),
    );
    try {
      await rpcService.bootstrap(this._bootstrapInfo).refCount().toPromise();
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

  supportSingleThreadStepping(): boolean {
    return true;
  }

  getDebuggerConfig(): DebuggerConfig {
    return {
      logLevel: getConfig().serverLogLevel,
      pythonBinaryPath: getConfig().pythonBinaryPath,
      buckConfigRootFile: getConfig().buckConfigRootFile,
      lldbPythonPath: this._bootstrapInfo.lldbPythonPath ||
        getConfig().lldbPythonPath,
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
