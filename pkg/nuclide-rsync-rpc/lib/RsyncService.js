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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {splitStream} from 'nuclide-commons/observable';
import {
  observeProcess,
  observeProcessRaw,
  runCommand,
} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import {getAvailableServerPort} from 'nuclide-commons/serverPort';
import compareVersions from '../../commons-node/compareVersions';

export type RsyncDaemonReadyMessage = {
  version: string,
  port: number,
};

/**
 * Start an rsync daemon with a single module at the provided root.
 * NOTE: This function works by tailing rsync's log and wating for a log entry.
 * I tried setting the log file to /dev/stdout. This worked on OSX but not
 * linux. I tried a named pipe, but if the named pipe isn't drained, rsync will
 * block while writing an exit message to it's log and never quit.
 */
export function startDaemon(
  root: NuclideUri,
): ConnectableObservable<RsyncDaemonReadyMessage> {
  return Observable.combineLatest(
    Observable.defer(() => fsPromise.tempdir()),
    Observable.defer(() => getAvailableServerPort()),
  )
    .switchMap(([tempDir, port]) => {
      const confFile = nuclideUri.join(tempDir, 'rsync.conf');
      const lockFile = nuclideUri.join(tempDir, 'rsync.lock');
      const pidFile = nuclideUri.join(tempDir, 'rsync.pid');
      const logFile = nuclideUri.join(tempDir, 'rsync.log');

      const conf = `
lock file = ${lockFile}
pid file = ${pidFile}
log file = ${logFile}
port = ${port}
use chroot = false

[files]
path = ${nuclideUri.getPath(root)}
read only = no`;

      return Observable.concat(
        Observable.merge(
          // Create the config file.
          Observable.defer(() => fsPromise.writeFile(confFile, conf)),
          // Create an empty log file.
          Observable.defer(() => fsPromise.writeFile(logFile, '')),
        ).ignoreElements(),
        Observable.merge(
          // Simultaneously start daemon and tail log.
          observeProcess(
            'rsync',
            ['--daemon', '--no-detach', '-v', '--config', confFile],
            {
              // We need to pipe in /dev/null due to stdin
              // https://lists.samba.org/archive/rsync/2007-May/017739.html
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          ).ignoreElements(),
          observeProcess('tail', ['-f', '-n', '+1', logFile])
            // Get a stream of stdout lines.
            .concatMap(
              msg =>
                msg.kind === 'stdout'
                  ? Observable.of(msg.data)
                  : Observable.empty(),
            )
            // Match the pattern to the stdout lines.
            .concatMap(line => {
              const VERSION_PORT_PATTERN = /rsyncd version ([\d.]+) starting, listening on port (\d+)/g;
              const match = VERSION_PORT_PATTERN.exec(line);
              if (match) {
                return Observable.of({
                  version: match[1],
                  port: parseInt(match[2], 10),
                });
              }
              return Observable.empty();
            })
            .first()
            .timeoutWith(
              4000,
              Observable.throw(
                new Error(
                  'Timed out while trying to retrieve rsync daemon port.',
                ),
              ),
            ),
        ),
      );
    })
    .publish();
}

export type RsyncVersionInfo = {
  rsyncVersion: string,
  protocolVersion: number,
};

export function getVersion(): Promise<RsyncVersionInfo> {
  return runCommand('rsync', ['--version'])
    .flatMap(stdout => Observable.from(stdout.split('\n')))
    .first()
    .concatMap(line => {
      const VERSION_PATTERN = /rsync\s+version\s+([\d.]+)\s+protocol\s+version\s+(\d+)/g;
      const match = VERSION_PATTERN.exec(line);
      return match
        ? Observable.of({
            rsyncVersion: match[1],
            protocolVersion: parseInt(match[2], 10),
          })
        : Observable.throw('Failed to parse Rsync version.');
    })
    .toPromise();
}

export function syncFolder(
  from: string,
  to: string,
): ConnectableObservable<number> {
  return Observable.defer(() => getVersion())
    .switchMap(version => {
      const args = ['-rtvuc', '--delete', '--progress', from, to];
      if (compareVersions(version.rsyncVersion, '3.1.0') >= 0) {
        args.push('--info=progress2');
      }

      return splitStream(
        observeProcessRaw('rsync', args)
          .concatMap(
            msg =>
              msg.kind === 'stdout'
                ? Observable.of(msg.data)
                : Observable.empty(),
          )
          .map(data => data.replace(/\r/g, '\n')),
      ).concatMap(line => {
        const PROGRESS_PATTERN = /(\d+)%/g;
        const match = PROGRESS_PATTERN.exec(line);
        return match
          ? Observable.of(parseInt(match[1], 10))
          : Observable.empty();
      });
    })
    .publish();
}
