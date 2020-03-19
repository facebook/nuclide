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

import type {SshTunnelService, Tunnel} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TunnelBehavior} from './types';

import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri';
import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import {Observable} from 'rxjs';

export function openTunnel(
  serviceUri: NuclideUri,
  behavior: TunnelBehavior,
  port: number,
): Observable<'ready'> {
  if (!nuclideUri.isRemote(serviceUri) || behavior === 'do_not_open_tunnel') {
    return Observable.of('ready').concat(Observable.never());
  }
  return Observable.defer(() =>
    nullthrows(consumeFirstProvider('nuclide.ssh-tunnel')),
  )
    .switchMap((service: SshTunnelService) => {
      const desired = _desiredTunnelTo(serviceUri, port);
      for (const tunnel of service.getOpenTunnels()) {
        const {from, to} = tunnel;
        if (
          from.port === desired.from.port &&
          from.host === desired.from.host
        ) {
          if (
            nuclideUri.getHostname(to.host) !==
            nuclideUri.getHostname(desired.to.host)
          ) {
            throw new Error(
              `You have a tunnel open from \`localhost:${port}\` to a different host than your ` +
                'Current Working Root. Close the tunnel in the Nuclide tunnels panel and try again.',
            );
          }
        }
      }
      if (behavior === 'ask_about_tunnel') {
        return _askToRequestTunnel(service, desired);
      } else {
        return service.openTunnels([desired]);
      }
    })
    .mapTo('ready')
    .share();
}

function _askToRequestTunnel(
  service: SshTunnelService,
  tunnel: Tunnel,
): Observable<'ready'> {
  return Observable.create(observer => {
    let subscription;
    const notification = atom.notifications.addSuccess('Open tunnel?', {
      detail: `Open a new tunnel so Metro becomes available at localhost:${
        tunnel.from.port
      }?`,
      icon: 'milestone',
      dismissable: true,
      buttons: [
        {
          text: 'Open tunnel',
          onDidClick: () => {
            subscription = service.openTunnels([tunnel]).subscribe(observer);
            notification.dismiss();
          },
        },
        {
          text: 'Dismiss',
          onDidClick: () => notification.dismiss(),
        },
      ],
    });

    return () => {
      if (subscription != null) {
        subscription.unsubscribe();
      }
      notification.dismiss();
    };
  }).mapTo('ready');
}

function _desiredTunnelTo(uri: NuclideUri, port: number): Tunnel {
  return {
    description: 'Metro',
    from: {
      host: 'localhost',
      port,
    },
    to: {host: uri, port},
  };
}
