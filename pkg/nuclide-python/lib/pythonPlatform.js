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
import type {PlatformGroup} from '../../nuclide-buck/lib/types';

import {Observable} from 'rxjs';

export function providePythonPlatformGroup(
  buckRoot: NuclideUri,
  ruleType: string,
  buildTarget: string,
): Observable<?PlatformGroup> {
  try {
    // $FlowFB
    const fbPythonPlatform = require('./fb-pythonPlatform');
    return fbPythonPlatform.providePythonPlatformGroup(
      buckRoot,
      ruleType,
      buildTarget,
    );
  } catch (error) {
    return Observable.of(null);
  }
}
