/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  PythonDebuggerAttachTarget,
  RemoteDebugCommandRequest,
} from './RemoteDebuggerCommandService';
import type {IProcessConfig} from 'nuclide-debugger-common';
import typeof * as RemoteDebuggerCommandService from './RemoteDebuggerCommandService';

import {getDebuggerService} from 'nuclide-commons-atom/debugger';
import {observeAddedHostnames} from 'nuclide-commons-atom/projects';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {fastDebounce} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {VsAdapterTypes} from 'nuclide-debugger-common';
import {Observable} from 'rxjs';
import {track} from 'nuclide-commons/analytics';
import * as RemoteDebuggerCommandServiceLocal from './RemoteDebuggerCommandService';
import nullthrows from 'nullthrows';
import {getLogger} from 'log4js';

let _rpcService: ?nuclide$RpcService = null;

function getPythonAttachTargetProcessConfig(
  targetRootUri: NuclideUri,
  target: PythonDebuggerAttachTarget,
): IProcessConfig {
  return {
    targetUri: targetRootUri,
    debugMode: 'attach',
    adapterType: VsAdapterTypes.PYTHON,
    config: getPythonAttachTargetConfig(target),
    servicedFileExtensions: ['py'],
  };
}

function getPythonAttachTargetConfig(
  target: PythonDebuggerAttachTarget,
): Object {
  return {
    localRoot: target.localRoot,
    remoteRoot: target.remoteRoot,
    port: target.port,
    host: '127.0.0.1',
  };
}

export function setRpcService(rpcService: nuclide$RpcService): IDisposable {
  _rpcService = rpcService;
  return new UniversalDisposable(() => {
    _rpcService = null;
  });
}

export function listenToRemoteDebugCommands(): IDisposable {
  const addedHostnames = observeAddedHostnames().startWith('local');

  const remoteDebuggerServices = addedHostnames.flatMap(hostname => {
    const rootUri =
      hostname === 'local' ? '' : nuclideUri.createRemoteUri(hostname, '/');
    const service = getRemoteDebuggerCommandServiceByNuclideUri(rootUri);
    if (service == null) {
      getLogger().error('null remote command service for uri:', rootUri);
      return Observable.empty();
    } else {
      return Observable.of({service, rootUri});
    }
  });

  return new UniversalDisposable(
    remoteDebuggerServices
      .flatMap(({service, rootUri}) => {
        return service
          .observeAttachDebugTargets()
          .refCount()
          .map(targets => findDuplicateAttachTargetIds(targets));
      })

      .subscribe(duplicateTargetIds =>
        notifyDuplicateDebugTargets(duplicateTargetIds),
      ),
    remoteDebuggerServices
      .flatMap(({service, rootUri}) => {
        return service
          .observeRemoteDebugCommands()
          .refCount()
          .catch(error => {
            // eslint-disable-next-line no-console
            console.warn(
              'Failed to listen to remote debug commands - ' +
                'You could be running locally with two Atom windows. ' +
                `IsLocal: ${String(rootUri === '')}`,
            );
            return Observable.empty();
          })
          .map((command: RemoteDebugCommandRequest) => ({rootUri, command}));
      })
      .let(fastDebounce(500))
      .subscribe(async ({rootUri, command}) => {
        const attachProcessConfig = getPythonAttachTargetProcessConfig(
          rootUri,
          command.target,
        );
        const debuggerService = await getDebuggerService();
        track('fb-python-debugger-auto-attach');
        debuggerService.startVspDebugging(attachProcessConfig);
        // Otherwise, we're already debugging that target.
      }),
  );
}

let shouldNotifyDuplicateTargets = true;
let duplicateTargetsNotification;

function notifyDuplicateDebugTargets(duplicateTargetIds: Set<string>): void {
  if (
    duplicateTargetIds.size > 0 &&
    shouldNotifyDuplicateTargets &&
    duplicateTargetsNotification == null
  ) {
    const formattedIds = Array.from(duplicateTargetIds).join(', ');
    duplicateTargetsNotification = atom.notifications.addInfo(
      `Debugger: duplicate attach targets: \`${formattedIds}\``,
      {
        buttons: [
          {
            onDidClick: () => {
              shouldNotifyDuplicateTargets = false;
              if (duplicateTargetsNotification != null) {
                duplicateTargetsNotification.dismiss();
              }
            },
            text: 'Ignore',
          },
        ],
        description:
          `Nuclide debugger detected duplicate attach targets with ids (${formattedIds}) ` +
          'That could be instagram running multiple processes - check out https://our.intern.facebook.com/intern/dex/instagram-server/debugging-with-nuclide/',
        dismissable: true,
      },
    );
    duplicateTargetsNotification.onDidDismiss(() => {
      duplicateTargetsNotification = null;
    });
  }
}

function findDuplicateAttachTargetIds(
  targets: Array<PythonDebuggerAttachTarget>,
): Set<string> {
  const targetIds = new Set();
  const duplicateTargetIds = new Set();
  targets.forEach(target => {
    const {id} = target;
    if (id == null) {
      return;
    }
    if (targetIds.has(id)) {
      duplicateTargetIds.add(id);
    } else {
      targetIds.add(id);
    }
  });
  return duplicateTargetIds;
}

export function getRemoteDebuggerCommandServiceByNuclideUri(
  uri: NuclideUri,
): RemoteDebuggerCommandService {
  if (_rpcService == null && !nuclideUri.isRemote(uri)) {
    return RemoteDebuggerCommandServiceLocal;
  }

  return nullthrows(_rpcService).getServiceByNuclideUri(
    'RemoteDebuggerCommandService',
    uri,
  );
}
