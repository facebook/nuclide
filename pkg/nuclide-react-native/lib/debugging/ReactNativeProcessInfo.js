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

import {DebuggerProcessInfo} from '../../../nuclide-debugger-base';
import {ReactNativeDebuggerInstance} from './ReactNativeDebuggerInstance';

export class ReactNativeProcessInfo extends DebuggerProcessInfo {
  constructor(targetUri: NuclideUri) {
    super('react-native', targetUri);
  }

  clone(): ReactNativeProcessInfo {
    return new ReactNativeProcessInfo(this._targetUri);
  }

  debug(): Promise<ReactNativeDebuggerInstance> {
    // This is the port that the V8 debugger usually listens on.
    // TODO(matthewwithanm): Provide a way to override this in the UI.
    return Promise.resolve(new ReactNativeDebuggerInstance(this, 5858));
  }
}
