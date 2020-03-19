/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {SshTunnelService} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Subscription} from 'rxjs';

import invariant from 'assert';
import {shell} from 'electron';
import {getLogger} from 'log4js';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable, Subject} from 'rxjs';
import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import {getAdbServiceByNuclideUri} from './utils';
import {track} from 'nuclide-commons/analytics';

export type AdbTunnelingOptions = {
  adbUpgradeLink?: string,
};

let passesGK = async _ => false;
try {
  const fbPassesGK =
    // eslint-disable-next-line nuclide-internal/modules-dependencies
    require('nuclide-commons/passesGK');
  passesGK = fbPassesGK.default;
} catch (e) {}

export const MISSING_ADB_ERROR = 'MissingAdbError';
export const VERSION_MISMATCH_ERROR = 'VersionMismatchError';

// 1. Starts adb tunneling immediately (does not care if you subscribe)
// 2. Tunneling stays turned on even after you unsubscribe (to prevent too much on/off toggling)
// 3. Sends a value when everything is ready (if already active, it sends 'ready' immediately)
// 4. Guarantees that tunneling is active as long as the observable is not complete (or errored)
export function startTunnelingAdb(
  uri: NuclideUri,
  options?: AdbTunnelingOptions = {},
): Observable<'ready'> {
  if (!nuclideUri.isRemote(uri)) {
    return Observable.of('ready').concat(Observable.never());
  }
  const {tunnels} = activeTunnels.getOrCreate(uri, (_, serviceUri) => {
    invariant(typeof serviceUri === 'string');
    const adbService = getAdbServiceByNuclideUri(serviceUri);
    const localAdbService = getAdbServiceByNuclideUri('');

    const observable = Observable.defer(async () => {
      try {
        const [adbVersion, localAdbVersion] = await Promise.all([
          adbService.getVersion().catch(e => {
            e.host = serviceUri;
            throw e;
          }),
          localAdbService.getVersion().catch(e => {
            e.host = '';
            throw e;
          }),
        ]);

        if (adbVersion !== localAdbVersion) {
          const versionMismatchError = new Error(
            `Your remote adb version differs from the local one: ${adbVersion} (remote) != ${localAdbVersion} (local)`,
          );
          versionMismatchError.name = VERSION_MISMATCH_ERROR;
          throw versionMismatchError;
        }
      } catch (e) {
        if (e.code === 'ENOENT' && e.host != null) {
          const missingAdbError = new Error(
            `'adb' not found in ${e.host === '' ? 'local' : 'remote'} $PATH.`,
          );
          missingAdbError.name = MISSING_ADB_ERROR;
          throw missingAdbError;
        } else {
          throw e;
        }
      }

      return adbService.checkMuxStatus();
    })
      .switchMap(
        useAdbmux =>
          useAdbmux
            ? checkInToAdbmux(serviceUri)
            : openTunnelsManually(serviceUri),
      )
      .publishReplay(1);

    let adbmuxPort;
    const subscription = observable.subscribe({
      next: port => (adbmuxPort = port),
      error: e => {
        getLogger('nuclide-adb:tunneling').error(e);
        track('nuclide-adb:tunneling:error', {host: uri, error: e});
        if (e.name === MISSING_ADB_ERROR) {
          return;
        }
        let detail;
        const buttons = [];
        if (e.name === VERSION_MISMATCH_ERROR) {
          detail = e.message;
          const {adbUpgradeLink} = options;
          if (e.name === VERSION_MISMATCH_ERROR && adbUpgradeLink != null) {
            buttons.push({
              text: 'View upgrade instructions',
              onDidClick: () => shell.openExternal(adbUpgradeLink),
            });
          }
        } else {
          detail =
            "Your local devices won't be available on this host." +
            (e.name != null && e.name !== 'Error' ? `\n \n${e.name}` : '');
        }
        atom.notifications.addError('Failed to tunnel Android devices', {
          dismissable: true,
          detail,
          buttons,
        });
      },
    });

    // .add returns a Subscription, the teardown logic of which doesn't seem to get disposed on unsubscribe
    subscription
      .add(() => {
        if (adbmuxPort != null) {
          adbService.checkOutMuxPort(adbmuxPort);
          adbmuxPort = null;
        }
        stopTunnelingAdb(uri);
      })
      // Start everything!
      .add(observable.connect());

    return {
      subscription,
      tunnels: observable,
    };
  });
  changes.next();

  return tunnels.mapTo('ready');
}

export function stopTunnelingAdb(uri: NuclideUri) {
  activeTunnels.delete(uri);
  changes.next();
}

export function isAdbTunneled(uri: NuclideUri): Observable<boolean> {
  return changes
    .startWith(undefined)
    .map(() => activeTunnels.get(uri) != null)
    .distinctUntilChanged();
}

const activeTunnels: SimpleCache<
  NuclideUri,
  {tunnels: Observable<?number>, subscription: Subscription},
> = new SimpleCache({
  keyFactory: uri =>
    nuclideUri.createRemoteUri(nuclideUri.getHostname(uri), '/'),
  dispose: value => value.subscription.unsubscribe(),
});
const changes: Subject<void> = new Subject();

function checkInToAdbmux(host: NuclideUri): Observable<?number> {
  return Observable.defer(async () => {
    const getService: Promise<SshTunnelService> = consumeFirstProvider(
      'nuclide.ssh-tunnel',
    );
    const [service, avoidPrecreatingExopackageTunnel] = await Promise.all([
      getService,
      passesGK('nuclide_adb_exopackage_tunnel'),
    ]);
    invariant(service);
    return {service, avoidPrecreatingExopackageTunnel};
  })
    .switchMap(({service, avoidPrecreatingExopackageTunnel}) => {
      const tunnels = [
        {
          description: 'adbmux',
          from: {host, port: 'any_available', family: 4},
          to: {host: 'localhost', port: 5037, family: 4},
        },
      ];
      if (!avoidPrecreatingExopackageTunnel) {
        tunnels.push({
          description: 'exopackage',
          from: {host, port: 2829, family: 4},
          to: {host: 'localhost', port: 2829, family: 4},
        });
      }
      return service
        .openTunnels(tunnels)
        .map(resolved => resolved[0].from.port);
    })
    .switchMap(async port => {
      const service = getAdbServiceByNuclideUri(host);
      await service.checkInMuxPort(port);
      return port;
    });
}

function openTunnelsManually(host: NuclideUri): Observable<?number> {
  let retries = 3;
  return Observable.defer(async () => {
    await getAdbServiceByNuclideUri(host).killServer();

    const service: SshTunnelService = await consumeFirstProvider(
      'nuclide.ssh-tunnel',
    );
    invariant(service);
    return service;
  })
    .timeout(5000)
    .switchMap(service =>
      service.openTunnels([
        {
          description: 'adb',
          from: {host, port: 5037, family: 4},
          to: {host: 'localhost', port: 5037, family: 4},
        },
        {
          description: 'emulator console',
          from: {host, port: 5554, family: 4},
          to: {host: 'localhost', port: 5554, family: 4},
        },
        {
          description: 'emulator adb',
          from: {host, port: 5555, family: 4},
          to: {host: 'localhost', port: 5555, family: 4},
        },
        {
          description: 'exopackage',
          from: {host, port: 2829, family: 4},
          to: {host: 'localhost', port: 2829, family: 4},
        },
      ]),
    )
    .retryWhen(errors => {
      return errors.do(error => {
        if (retries-- <= 0) {
          throw error;
        }
      });
    })
    .mapTo(null);
}
