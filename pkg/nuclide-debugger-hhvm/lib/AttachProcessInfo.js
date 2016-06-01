'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import invariant from 'assert';
import {DebuggerProcessInfo} from '../../nuclide-debugger-atom';
import {HhvmDebuggerInstance} from './HhvmDebuggerInstance';

import type {NuclideUri} from '../../nuclide-remote-uri';

export class AttachProcessInfo extends DebuggerProcessInfo {
  constructor(targetUri: NuclideUri) {
    super('hhvm', targetUri);
  }

  async debug(): Promise<HhvmDebuggerInstance> {
    try {
      // $FlowFB
      const services = require('./fb/services');
      await services.warnIfNotBuilt(this.getTargetUri());
    } catch (_) {}
    return new HhvmDebuggerInstance(this);
  }

  compareDetails(other: DebuggerProcessInfo): number {
    invariant(other instanceof AttachProcessInfo);
    return compareString(this._targetUri, other._targetUri);
  }

  displayString(): string {
    const remoteUri = require('../../nuclide-remote-uri');
    return remoteUri.getHostname(this._targetUri);
  }
}

function compareString(value1: string, value2: string): number {
  return value1 === value2 ? 0 : (value1 < value2 ? -1 : 1);
}
