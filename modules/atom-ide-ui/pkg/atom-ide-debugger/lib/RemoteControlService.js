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

import type {IDebugService, RemoteDebuggerService} from './types';
import type {IProcessConfig} from 'nuclide-debugger-common';

export default class RemoteControlService implements RemoteDebuggerService {
  _service: IDebugService;

  constructor(service: IDebugService) {
    this._service = service;
  }

  startVspDebugging(config: IProcessConfig): Promise<void> {
    return this._service.startDebugging(config);
  }

  onDidChangeDebuggerSessions(
    callback: (sessionConfigs: IProcessConfig[]) => mixed,
  ): IDisposable {
    return this._service.getModel().onDidChangeProcesses(() => {
      callback(
        this._service
          .getModel()
          .getProcesses()
          .map(p => p.configuration),
      );
    });
  }

  getDebugSessions(): IProcessConfig[] {
    return this._service
      .getModel()
      .getProcesses()
      .map(p => p.configuration);
  }
}
