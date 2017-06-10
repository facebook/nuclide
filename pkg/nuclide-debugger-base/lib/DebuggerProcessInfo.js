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
  ControlButtonSpecification,
} from '../../nuclide-debugger/lib/types';
import type {ThreadColumn} from '../../nuclide-debugger-base/lib/types';

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

  getThreadsComponentTitle(): string {
    return 'Threads';
  }

  getThreadColumns(): ?Array<ThreadColumn> {
    // Use the debugger view's default columns.
    return null;
  }

  // Whether or not this ProcessInfo supports threading or not.
  // TODO: move this into chrome protocol after we move threads window
  // to Nuclide UI.
  supportThreads(): boolean {
    return false;
  }

  configureSourceFilePaths(): void {
    // Debuggers that support this will override this routine.
    throw new Error('Not supported');
  }

  supportsConfigureSourcePaths(): boolean {
    return false;
  }

  supportSingleThreadStepping(): boolean {
    return false;
  }

  supportContinueToLocation(): boolean {
    return false;
  }

  singleThreadSteppingEnabled(): boolean {
    return false;
  }

  clone(): DebuggerProcessInfo {
    throw new Error('abstract method');
  }

  customControlButtons(): Array<ControlButtonSpecification> {
    return [];
  }

  async debug(): Promise<DebuggerInstanceBase> {
    throw new Error('abstract method');
  }

  dispose(): void {}
}
