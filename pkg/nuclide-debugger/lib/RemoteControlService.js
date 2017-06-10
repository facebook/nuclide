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

import type DebuggerModel from './DebuggerModel';
import type {DebuggerProcessInfo} from '../../nuclide-debugger-base';

export default class RemoteControlService {
  _getModel: () => ?DebuggerModel;

  /**
   * @param getModel function always returning the latest singleton model.
   *
   * NB: Deactivating and reactivating will result in a new Model instance (and
   * new instances of everything else). This object exists in other packages
   * outside of any model, so objects vended early must still always manipulate
   * the latest model's state.
   */
  constructor(getModel: () => ?DebuggerModel) {
    this._getModel = getModel;
  }

  async startDebugging(processInfo: DebuggerProcessInfo): Promise<void> {
    const model = this._getModel();
    if (model == null) {
      throw new Error('Package is not activated.');
    }
    await model.getActions().startDebugging(processInfo);
  }

  toggleBreakpoint(filePath: string, line: number): void {
    const model = this._getModel();
    if (model == null) {
      throw new Error('Package is not activated.');
    }
    model.getActions().toggleBreakpoint(filePath, line);
  }

  isInDebuggingMode(providerName: string): boolean {
    const model = this._getModel();
    if (model == null) {
      throw new Error('Package is not activated.');
    }
    const session = model.getStore().getDebuggerInstance();
    return session != null && session.getProviderName() === providerName;
  }

  killDebugger(): void {
    const model = this._getModel();
    if (model == null) {
      throw new Error('Package is not activated.');
    }
    model.getActions().stopDebugging();
  }
}
