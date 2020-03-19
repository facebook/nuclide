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
import type {Subscription} from 'rxjs';

import invariant from 'assert';
import {getLogger} from 'log4js';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable, Subject} from 'rxjs';
import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import {track} from 'nuclide-commons/analytics';
import {getIdbServiceByNuclideUri} from '../../nuclide-remote-connection';

export const MISSING_IDB_ERROR = 'MissingIdbError';

// 1. Starts idb tunneling immediately (does not care if you subscribe)
// 2. Tunneling stays turned on even after you unsubscribe (to prevent too much on/off toggling)
// 3. Sends a value when everything is ready (if already active, it sends 'ready' immediately)
// 4. Guarantees that tunneling is active as long as the observable is not complete (or errored)
export function startTunnelingIdb(uri: NuclideUri): Observable<'ready'> {
  if (!nuclideUri.isRemote(uri)) {
    return Observable.of('ready').concat(Observable.never());
  }
  const {tunnels} = activeTunnels.getOrCreate(uri, (_, serviceUri) => {
    invariant(typeof serviceUri === 'string');
    const idbService = getIdbServiceByNuclideUri(serviceUri);

    const observable = Observable.defer(() =>
      connectToIdb(serviceUri),
    ).publishReplay(1);

    let idbDaemonPort;
    const subscription = observable.subscribe({
      next: port => (idbDaemonPort = port),
      error: e => {
        getLogger('nuclide-idb:tunneling').error(e);
        track('nuclide-idb:tunneling:error', {host: uri, error: e});
        const detail =
          "Your local devices won't be available on this host." +
          (e.name != null && e.name !== 'Error' ? `\n \n${e.name}` : '');
        atom.notifications.addError('Failed to tunnel iOS devices', {
          dismissable: true,
          detail,
        });
      },
    });

    // .add returns a Subscription, the teardown logic of which doesn't seem to get disposed on unsubscribe
    subscription
      .add(() => {
        if (idbDaemonPort != null) {
          idbService.disconnectFromDaemon('localhost', idbDaemonPort);
          idbDaemonPort = null;
        }
        stopTunnelingIdb(uri);
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

export function stopTunnelingIdb(uri: NuclideUri) {
  activeTunnels.delete(uri);
  changes.next();
}

export function isIdbTunneled(uri: NuclideUri): Observable<boolean> {
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

function connectToIdb(host: NuclideUri): Observable<?number> {
  return Observable.defer(async () => {
    const service: SshTunnelService = await consumeFirstProvider(
      'nuclide.ssh-tunnel',
    );
    invariant(service);
    return service;
  })
    .switchMap(service => {
      const tunnels = [
        {
          description: 'idb',
          from: {host, port: 'any_available'},
          to: {host: 'localhost', port: 9888},
        },
      ];
      return service
        .openTunnels(tunnels)
        .map(resolved => resolved[0].from.port);
    })
    .switchMap(async port => {
      const service = getIdbServiceByNuclideUri(host);
      await service.connectToDaemon('localhost', port);
      return port;
    });
}
