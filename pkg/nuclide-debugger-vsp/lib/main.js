/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideDebuggerProvider} from 'nuclide-debugger-common';

import createPackage from 'nuclide-commons-atom/createPackage';
import {VsAdapterTypes, VsAdapterNames} from 'nuclide-debugger-common';
import {getNativeAutoGenConfig} from 'nuclide-debugger-common/autogen-utils';
import {AutoGenLaunchAttachProvider} from 'nuclide-debugger-common/AutoGenLaunchAttachProvider';
import HhvmLaunchAttachProvider from './HhvmLaunchAttachProvider';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import type {GatekeeperService} from 'nuclide-commons-atom/types';

class Activation {
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable();
    this._registerLLDBProvider();
    this._registerHHVMDebugProvider();
  }

  _javaCheck(_gkService: GatekeeperService) {
    if (_gkService != null) {
      _gkService.passesGK('nuclide_extrafeatures_debugging').then(passes => {
        if (passes) {
          try {
            this._subscriptions.add(
              // $FlowFB
              require('./fb-JavaCheck').javaCheck(),
            );
          } catch (_) {}
        }
      });
    }
  }

  _registerDebugProvider(provider: NuclideDebuggerProvider): void {
    this._subscriptions.add(
      atom.packages.serviceHub.provide('debugger.provider', '0.0.0', provider),
    );
  }

  _registerLLDBProvider() {
    this._registerDebugProvider({
      type: VsAdapterTypes.NATIVE_LLDB,
      getLaunchAttachProvider: connection => {
        return new AutoGenLaunchAttachProvider(
          VsAdapterNames.NATIVE_LLDB,
          connection,
          getNativeAutoGenConfig(VsAdapterTypes.NATIVE_LLDB),
        );
      },
    });
  }

  _registerHHVMDebugProvider(): void {
    this._registerDebugProvider({
      type: VsAdapterTypes.HHVM,
      getLaunchAttachProvider: connection => {
        return new HhvmLaunchAttachProvider(VsAdapterNames.HHVM, connection);
      },
    });
  }

  consumeGatekeeperService(service: GatekeeperService): IDisposable {
    let _gkService = service;
    this._javaCheck(_gkService);
    return new UniversalDisposable(() => (_gkService = null));
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

createPackage(module.exports, Activation);
