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

import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {NuclideDebuggerProvider} from '../../nuclide-debugger-interfaces/service';
import type {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {HhvmLaunchAttachProvider} from './HhvmLaunchAttachProvider';
import nuclideUri from 'nuclide-commons/nuclideUri';

export function createDebuggerProvider(): NuclideDebuggerProvider {
  return {
    name: 'hhvm',
    getLaunchAttachProvider(
      connection: NuclideUri,
    ): ?DebuggerLaunchAttachProvider {
      if (nuclideUri.isRemote(connection)) {
        return new HhvmLaunchAttachProvider('Hack / PHP', connection);
      }
      return null;
    },
  };
}

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'PHP Debugger',
      icon: 'nuclicon-debugger',
      description:
        'Connect to a PHP server process and debug Hack code from within Nuclide.',
      command: 'nuclide-debugger:show-attach-dialog',
    },
    priority: 6,
  };
}
