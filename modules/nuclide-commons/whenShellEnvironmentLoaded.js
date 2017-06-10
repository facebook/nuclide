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

// TODO(T17266325): Remove this module when `atom.whenShellEnvironmentLoaded()` lands.

import {ReplaySubject} from 'rxjs';

import UniversalDisposable from './UniversalDisposable';

const emitter = new ReplaySubject(1);

export function loadedShellEnvironment(): void {
  emitter.next();
}

function whenShellEnvironmentLoaded(cb: () => void): IDisposable {
  return new UniversalDisposable(emitter.take(1).subscribe(cb));
}

export default (typeof atom === 'undefined'
  ? null
  : whenShellEnvironmentLoaded);
