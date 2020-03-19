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

import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {
  AdditionalLogFilesProvider,
  AdditionalLogFile,
} from '../../nuclide-logging/lib/rpc-types';
import type {DeadlineRequest} from 'nuclide-commons/promise';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {getHhvmDebuggerServiceByNuclideUri} from '../../nuclide-remote-connection';
import {arrayUnique} from 'nuclide-commons/collection';

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'Hack/PHP Debugger',
      icon: 'nuclicon-debugger',
      description:
        'Connect to an HHVM server process and debug Hack/PHP code from within Nuclide.',
      command: 'debugger:show-attach-dialog',
    },
    priority: 6,
  };
}

async function getAdditionalLogFiles(
  deadline: DeadlineRequest,
): Promise<Array<AdditionalLogFile>> {
  const hostnames = arrayUnique(
    atom.project
      .getPaths()
      .filter(nuclideUri.isRemote)
      .map(nuclideUri.getHostname),
  );

  return Promise.all(
    hostnames
      .map(
        async (hostname): Promise<AdditionalLogFile> => {
          const service = getHhvmDebuggerServiceByNuclideUri(
            nuclideUri.createRemoteUri(hostname, '/'),
          );
          if (service != null) {
            return {
              title: `HHVM Debugger log for ${hostname}`,
              data: await service.getDebugServerLog(),
            };
          }

          return {
            title: `HHVM Debugger log for ${hostname}`,
            data: '<service unavailable>',
          };
        },
      )
      .filter(file => file != null),
  );
}

export function createAdditionalLogFilesProvider(): AdditionalLogFilesProvider {
  return {
    id: 'hhvm-debugger',
    getAdditionalLogFiles,
  };
}
