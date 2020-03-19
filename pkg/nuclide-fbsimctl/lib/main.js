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

import type {Expected} from 'nuclide-commons/expected';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FbsimctlDevice} from '../../nuclide-fbsimctl-rpc/lib/types';

import {Expect, expectedEqual} from 'nuclide-commons/expected';
import nuclideUri from 'nuclide-commons/nuclideUri';
import passesGK from 'nuclide-commons/passesGK';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import {Observable} from 'rxjs';
import {arrayEqual} from 'nuclide-commons/collection';
import shallowEqual from 'shallowequal';
import {getLogger} from 'log4js';
import {track} from 'nuclide-analytics';
import {
  getFbsimctlServiceByNuclideUri,
  getIdbServiceByNuclideUri,
  getInfoServiceByNuclideUri,
} from '../../nuclide-remote-connection';

export function observeIosDevices(
  host: NuclideUri,
): Observable<Expected<Array<FbsimctlDevice>>> {
  const serviceUri = nuclideUri.isRemote(host)
    ? nuclideUri.createRemoteUri(nuclideUri.getHostname(host), '/')
    : '';

  return pollersForUris.getOrCreate(serviceUri, () => {
    return Observable.defer(() => passesGK('nuclide_idb_device_detection'))
      .concatMap(
        useIdb =>
          useIdb
            ? observeDevicesViaIdb(serviceUri)
            : observeDevicesViaFbsimctl(serviceUri),
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
          const logger = getLogger('nuclide-fbsimctl');
          let extras = {error};
          try {
            if (
              // $FlowIgnore
              (error: any).originalError != null &&
              // $FlowIgnore
              (error: any).originalError.code === 'ENOENT'
            ) {
              const serverEnv = await getInfoServiceByNuclideUri(
                serviceUri,
              ).getServerEnvironment();
              extras = {...extras, pathEnv: serverEnv.PATH};
            }
          } finally {
            logger.warn(value.error.message);
            track('nuclide-fbsimctl:device-poller:error', extras);
          }
        }
      })
      .publishReplay(1)
      .refCount();
  });
}

function observeDevicesViaFbsimctl(
  serviceUri: NuclideUri,
): Observable<Expected<Array<FbsimctlDevice>>> {
  if (nuclideUri.isRemote(serviceUri)) {
    return Observable.of(
      Expect.error(
        new Error('iOS devices on remote hosts are not currently supported.'),
      ),
    );
  }
  return Observable.interval(2000)
    .startWith(0)
    .exhaustMap(() => {
      const service = getFbsimctlServiceByNuclideUri(serviceUri);
      if (service == null) {
        // Gracefully handle a lost remote connection
        return Observable.of(Expect.pending());
      }
      return Observable.fromPromise(service.getDevices())
        .map(devices => Expect.value(devices))
        .catch(error => convertFbsimctlErrorToValue(error));
    });
}

function observeDevicesViaIdb(
  serviceUri: NuclideUri,
): Observable<Expected<Array<FbsimctlDevice>>> {
  return Observable.interval(2000)
    .startWith(0)
    .exhaustMap(() => {
      const service = getIdbServiceByNuclideUri(serviceUri);
      if (service == null) {
        // Gracefully handle a lost remote connection
        return Observable.of(Expect.pending());
      }
      return (
        Observable.fromPromise(service.listTargets())
          // convert to be compatible
          .map(devices =>
            devices.map(d => ({
              name: d.name,
              udid: d.udid,
              state: d.state,
              os: d.osVersion,
              arch: d.architecture,
              type: d.type === 'device' ? 'physical_device' : 'simulator',
            })),
          )
          .map(devices => Expect.value(devices))
          .catch(error => convertIdbErrorToValue(error))
      );
    });
}

function convertIdbErrorToValue(
  error: Error,
): Observable<Expected<Array<FbsimctlDevice>>> {
  let message;
  // $FlowFixMe error.code
  if (error.code === 'ENOENT') {
    message = "'idb' not found in $PATH.";
  } else if (
    // RPC call timed out
    error.name === 'RpcTimeoutError' ||
    // RPC call succeeded, but the idb call itself timed out
    error.message === 'Timeout has occurred'
  ) {
    message = 'Request timed out, retrying...';
  } else if (error.message === 'Connection Closed') {
    return Observable.of(Expect.pending());
  } else {
    message = error.message;
  }
  const newError = new Error("Can't fetch iOS devices. " + message);
  // $FlowIgnore
  (newError: any).originalError = error;
  return Observable.of(Expect.error(newError));
}

function convertFbsimctlErrorToValue(
  error: Error,
): Observable<Expected<Array<FbsimctlDevice>>> {
  let message;
  // $FlowFixMe error.code
  if (error.code === 'ENOENT') {
    message = "'fbsimctl' not found in $PATH.";
  } else if (
    typeof error.message === 'string' &&
    (error.message.includes('plist does not exist') ||
      error.message.includes('No Xcode Directory at'))
  ) {
    message =
      "Xcode path is invalid, use 'xcode-select' in a terminal to select path to an Xcode installation.";
  } else if (
    // RPC call timed out
    error.name === 'RpcTimeoutError' ||
    // RPC call succeeded, but the fbsimctl call itself timed out
    error.message === 'Timeout has occurred'
  ) {
    message = 'Request timed out, retrying...';
  } else if (error.message === 'Connection Closed') {
    return Observable.of(Expect.pending());
  } else {
    message = error.message;
  }
  const newError = new Error("Can't fetch iOS devices. " + message);
  // $FlowIgnore
  (newError: any).originalError = error;
  return Observable.of(Expect.error(newError));
}

const pollersForUris: SimpleCache<
  string,
  Observable<Expected<Array<FbsimctlDevice>>>,
> = new SimpleCache();
