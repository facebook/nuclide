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

import type {Expected} from 'nuclide-commons/expected';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {AdbDevice} from './types';

import {getLogger} from 'log4js';
import {arrayEqual} from 'nuclide-commons/collection';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import shallowEqual from 'shallowequal';
import {Observable} from 'rxjs';
import {Expect, expectedEqual} from 'nuclide-commons/expected';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {track} from 'nuclide-commons/analytics';
import {getAdbServiceByNuclideUri} from './utils';
import passesGK from 'nuclide-commons/passesGK';

export function observeAndroidDevices(
  host: NuclideUri,
): Observable<Expected<Array<AdbDevice>>> {
  const serviceUri = nuclideUri.isRemote(host)
    ? nuclideUri.createRemoteUri(nuclideUri.getHostname(host), '/')
    : '';
  return pollersForUris.getOrCreate(serviceUri, () => {
    return Observable.defer(() =>
      passesGK('nuclide_device_panel_use_adb_track_devices'),
    )
      .concatMap(
        useTrackDevices =>
          useTrackDevices
            ? observeDevicesViaTrackDevices(serviceUri)
            : observeDevicesViaPolling(serviceUri),
      )
      .distinctUntilChanged((a, b) =>
        expectedEqual(
          a,
          b,
          (v1, v2) => arrayEqual(v1, v2, shallowEqual),
          (e1, e2) => e1.message === e2.message,
        ),
      )
      .do(async value => {
        if (value.isError) {
          const {error} = value;
          const logger = getLogger('nuclide-adb');
          let extras = {error};
          try {
            if (
              // $FlowIgnore
              (error: any).originalError != null &&
              // $FlowIgnore
              (error: any).originalError.code === 'ENOENT'
            ) {
              const infoService = await getInfoServiceByNuclideUri(serviceUri);
              if (infoService != null) {
                const rpcEnv = infoService.getServerEnvironment();
                extras = {...extras, pathEnv: rpcEnv.PATH};
              }
            }
          } finally {
            logger.warn(value.error.message);
            track('nuclide-adb:device-poller:error', extras);
          }
        }
      })
      .publishReplay(1)
      .refCount();
  });
}

function convertErrorToValue(
  error: Error,
): Observable<Expected<Array<AdbDevice>>> {
  let message;
  // $FlowFixMe error.code
  if (error.code === 'ENOENT') {
    message = "'adb' not found in $PATH.";
  } else if (
    // RPC call timed out
    error.name === 'RpcTimeoutError' ||
    // RPC call succeeded, but the adb call itself timed out
    error.message === 'Timeout has occurred'
  ) {
    message = 'Request timed out, retrying...';
  } else if (error.message === 'Connection Closed') {
    return Observable.of(Expect.pending());
  } else {
    message = error.message;
  }
  const newError = new Error("Can't fetch Android devices. " + message);
  // $FlowIgnore
  (newError: any).originalError = error;
  return Observable.of(Expect.error(newError));
}

function observeDevicesViaPolling(
  serviceUri: NuclideUri,
): Observable<Expected<Array<AdbDevice>>> {
  return Observable.interval(2000)
    .startWith(0)
    .exhaustMap(() => {
      const service = getAdbServiceByNuclideUri(serviceUri);
      if (service == null) {
        // Gracefully handle a lost remote connection
        return Observable.of(Expect.pending());
      }
      return Observable.fromPromise(service.getDeviceList())
        .map(devices => Expect.value(devices))
        .catch(error => convertErrorToValue(error));
    });
}

function observeDevicesViaTrackDevices(
  serviceUri: NuclideUri,
): Observable<Expected<Array<AdbDevice>>> {
  return (
    Observable.defer(() => {
      const service = getAdbServiceByNuclideUri(serviceUri);
      if (service == null) {
        // Gracefully handle a lost remote connection
        return Observable.of(Expect.pending());
      }
      return service
        .trackDevices()
        .refCount()
        .map(devices => Expect.value(devices))
        .catch(error => convertErrorToValue(error));
    })
      // If the process ever exits, retry after 5s
      // $FlowFixMe repeatWhen
      .repeatWhen(notifications => notifications.delay(5000))
      // Also, never complete this observable, so we don't switch to a new observable
      // if the process exits, which would invalidate later caching (distinctUntilChanged/publishReplay)
      .merge(Observable.never())
  );
}

function getInfoServiceByNuclideUri(
  uri: NuclideUri,
  // $FlowIgnore env can contain anything
): ?{getServerEnvironment(): Promise<Object>} {
  let rpcService: ?nuclide$RpcService = null;
  // Atom's service hub is synchronous.
  atom.packages.serviceHub
    .consume('nuclide-rpc-services', '0.0.0', provider => {
      rpcService = provider;
    })
    .dispose();
  if (rpcService == null) {
    return null;
  }
  return rpcService.getServiceByNuclideUri('InfoService', uri);
}

// This is a convenient way for any device panel plugins of type Android to get from Device to
// to the strongly typed AdbDevice.
export async function adbDeviceForIdentifier(
  host: NuclideUri,
  identifier: string,
): Promise<?AdbDevice> {
  const devices = await observeAndroidDevices(host)
    .take(1)
    .toPromise();
  return devices.getOrDefault([]).find(d => d.serial === identifier);
}

const pollersForUris: SimpleCache<
  string,
  Observable<Expected<Array<AdbDevice>>>,
> = new SimpleCache();
