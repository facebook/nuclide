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

import type {SshTunnelService} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ProgressEvent} from 'nuclide-commons/process';
import typeof * as RsyncService from '../../nuclide-rsync-rpc';

import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import {getRsyncServiceByNuclideUri} from '../../nuclide-remote-connection';

interface RsyncTransport {
  downloadFolder: (remoteSource: NuclideUri) => Observable<ProgressEvent>;
}

/**
 * Set up an Rsync transport from a remote host to the local host. The daemon
 * will be spawned locally with localRoot as the module directory.
 */
export function setUpRsyncTransport<A>(
  remoteRoot: NuclideUri,
  localRoot: NuclideUri,
  rsyncActions: (rsync: RsyncTransport) => Observable<A>,
): Observable<A> {
  const remoteRsyncService = getRsyncServiceByNuclideUri(remoteRoot);
  const localRsyncService = getRsyncServiceByNuclideUri('');

  return (
    Observable.defer(() => consumeFirstProvider('nuclide.ssh-tunnel'))
      .switchMap((tunnelService: SshTunnelService) => {
        return localRsyncService
          .startDaemon(localRoot)
          .refCount()
          .switchMap(({port}) =>
            tunnelService
              .openTunnels([
                {
                  description: 'rsync',
                  from: {
                    host: remoteRoot,
                    family: 4,
                    port: 'any_available',
                  },
                  to: {
                    host: 'localhost',
                    family: 4,
                    port,
                  },
                },
              ])
              .switchMap(resolved =>
                rsyncActions({
                  downloadFolder: (remoteSource: NuclideUri) =>
                    downloadFolder(
                      remoteRsyncService,
                      resolved[0].from.port,
                      remoteSource,
                    ),
                }).materialize(),
              ),
          );
      })
      // $FlowFixMe dematerialize
      .dematerialize()
  );
}

/**
 * Download a remote folder to the current local root.
 */
function downloadFolder(
  rsyncService: RsyncService,
  port: number,
  remoteSource: NuclideUri,
): Observable<ProgressEvent> {
  return rsyncService
    .syncFolder(
      nuclideUri.getPath(remoteSource),
      `rsync://localhost:${port}/files/`,
    )
    .refCount()
    .map(progress => ({
      type: 'progress',
      progress: progress / 100,
    }));
}
