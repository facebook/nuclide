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

import typeof * as AdbService
  from '../../../nuclide-adb-sdb-rpc/lib/AdbService';
import typeof * as SdbService
  from '../../../nuclide-adb-sdb-rpc/lib/SdbService';
import type {DeviceTypeTaskProvider} from '../../../nuclide-devices/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TaskEvent} from 'nuclide-commons/process';
import type {DBPathsInfo} from '../../../nuclide-adb-sdb-rpc/lib/types';
import type {Store} from '../types';

import * as Actions from '../redux/Actions';
import showModal from '../../../nuclide-ui/showModal';
import {ATCustomDBPathModal} from './ui/ATCustomDBPathModal';
import {Observable} from 'rxjs';
import React from 'react';

export class ATConfigurePathTaskProvider implements DeviceTypeTaskProvider {
  _type: string;
  _rpcFactory: (host: NuclideUri) => AdbService | SdbService;
  _dbType: 'adb' | 'sdb';
  _store: Store;

  constructor(
    type: string,
    rpcFactory: (host: NuclideUri) => AdbService | SdbService,
    store: Store,
  ) {
    this._type = type;
    this._rpcFactory = rpcFactory;
    this._dbType = this._type === 'android' ? 'adb' : 'sdb';
    this._store = store;
  }

  getType(): string {
    return this._type;
  }

  getName(): string {
    return `Configure ${this._dbType}`;
  }

  _getPathsInfo(host: NuclideUri): Promise<DBPathsInfo> {
    return this._rpcFactory(host).getCurrentPathsInfo();
  }

  _getCurrentCustomPath(host: NuclideUri): ?string {
    const state = this._store.getState();
    return this._dbType === 'adb'
      ? state.customAdbPaths.get(host)
      : state.customSdbPaths.get(host);
  }

  _setCustomPath(host: NuclideUri, path: ?string): void {
    this._store.dispatch(
      this._dbType === 'adb'
        ? Actions.setCustomAdbPath(host, path)
        : Actions.setCustomSdbPath(host, path),
    );
  }

  getTask(host: NuclideUri): Observable<TaskEvent> {
    return Observable.defer(() =>
      this._getPathsInfo(host),
    ).switchMap(pathsInfo => {
      return Observable.create(observer => {
        const disposable = showModal(
          dismiss => (
            <ATCustomDBPathModal
              dismiss={dismiss}
              currentActivePath={pathsInfo.active}
              currentCustomPath={this._getCurrentCustomPath(host)}
              registeredPaths={pathsInfo.all}
              setCustomPath={customPath =>
                this._setCustomPath(host, customPath)}
              type={this._dbType}
            />
          ),
          {
            className: 'nuclide-adb-sdb-custom-path-modal',
            onDismiss: () => {
              disposable.dispose();
              observer.complete();
            },
            disableDismissOnClickOutsideModal: true,
          },
        );
      });
    });
  }
}
