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

import type DebuggerInstanceBase from './DebuggerInstance';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  DebuggerCapabilities,
  DebuggerProperties,
} from '../../nuclide-debugger-base';
import type {PausedEvent} from '../../nuclide-debugger-base/lib/protocol-types';

export default class DebuggerProcessInfo {
  _serviceName: string;
  _targetUri: NuclideUri;

  constructor(serviceName: string, targetUri: NuclideUri) {
    this._serviceName = serviceName;
    this._targetUri = targetUri;
  }

  getServiceName(): string {
    return this._serviceName;
  }

  getTargetUri(): NuclideUri {
    return this._targetUri;
  }

  getDebuggerCapabilities(): DebuggerCapabilities {
    return {
      conditionalBreakpoints: false,
      continueToLocation: false,
      customSourcePaths: false,
      disassembly: false,
      readOnlyTarget: false,
      registers: false,
      setVariable: false,
      singleThreadStepping: false,
      threads: false,
      completionsRequest: false,
    };
  }

  getDebuggerProps(): DebuggerProperties {
    return {
      customControlButtons: [],
      targetDescription: () => null,
      threadColumns: null,
      threadsComponentTitle: 'Threads',
    };
  }

  configureSourceFilePaths(): void {
    // Debuggers that support this will override this routine.
    throw new Error('Not supported');
  }

  clone(): DebuggerProcessInfo {
    throw new Error('abstract method');
  }

  shouldFilterBreak(pausedEvent: PausedEvent): boolean {
    // Gives an individual debugger front-end the option to auto-resume
    // from a break if it should be filtered so that the user doesn't see it.
    return false;
  }

  async debug(): Promise<DebuggerInstanceBase> {
    throw new Error('abstract method');
  }

  dispose(): void {}
}
