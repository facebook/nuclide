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
import type {Expected} from 'nuclide-commons/expected';
import type {
  DeviceTypeComponent,
  DeviceTypeComponentProvider,
} from 'nuclide-debugger-common/types';

import {WatchmanClient} from 'nuclide-watchman-helpers';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Expect} from 'nuclide-commons/expected';
import invariant from 'assert';
import fsPromise from 'nuclide-commons/fsPromise';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import os from 'os';
import {Observable, Subject} from 'rxjs';
import {runCommand} from 'nuclide-commons/process';
import {track} from 'nuclide-analytics';
import AvdTable from '../ui/AvdTable';

export type Avd = {
  name: string,
  running: boolean,
  pid?: number,
};

const AVD_DIRECTORY = `${os.homedir()}/.android/avd`;
const AVD_LOCKFILE = 'hardware-qemu.ini.lock';
// We create a temporary .watchmanconfig so Watchman recognizes the AVD
// directory as a project root.
const AVD_WATCHMAN_CONFIG = `${AVD_DIRECTORY}/.watchmanconfig`;

export class AvdComponentProvider implements DeviceTypeComponentProvider {
  _refresh: Subject<void> = new Subject();
  _emulator: ?string;

  getType(): string {
    return 'Android';
  }

  observe(
    host: NuclideUri,
    callback: (?DeviceTypeComponent) => void,
  ): IDisposable {
    // TODO (T26257016): Don't hide the table when ADB tunneling is on.
    if (nuclideUri.isRemote(host)) {
      callback(null);
      return new UniversalDisposable();
    }

    const disposables = this._watchAvdDirectory();

    const getProps = this._getAvds().map(avds => {
      return {
        avds,
        startAvd: this._startAvd,
      };
    });
    const props = getProps.concat(this._refresh.exhaustMap(_ => getProps));
    callback({
      position: 'below_table',
      type: bindObservableAsProps(props, AvdTable),
      key: 'emulators',
    });

    return disposables;
  }

  _watchAvdDirectory(): IDisposable {
    const watchAvdDirectory: Promise<() => mixed> = (async () => {
      const avdDirectoryExists = await fsPromise.exists(AVD_DIRECTORY);
      if (!avdDirectoryExists) {
        return () => {};
      }

      // Create a .watchmanconfig so Watchman recognizes the AVD directory as a
      // project root.
      await fsPromise.writeFile(AVD_WATCHMAN_CONFIG, '{}');

      const watchmanClient = new WatchmanClient();
      const watchmanSubscription = await watchmanClient.watchDirectoryRecursive(
        AVD_DIRECTORY,
        AVD_DIRECTORY,
        {
          expression: ['match', '*.avd'],
        },
      );
      watchmanSubscription.on('change', () => {
        this._refreshAvds();
      });

      return () => fsPromise.unlink(AVD_WATCHMAN_CONFIG).catch(() => {});
    })();

    return {
      dispose: () => {
        watchAvdDirectory.then(dispose => {
          dispose();
        });
      },
    };
  }

  _getEmulator(): Observable<?string> {
    return Observable.defer(async () => {
      const androidHome = process.env.ANDROID_HOME;
      const emulator =
        androidHome != null ? `${androidHome}/tools/emulator` : null;
      if (emulator == null) {
        return null;
      }
      const exists = await fsPromise.exists(emulator);
      this._emulator = exists ? emulator : null;
      return this._emulator;
    });
  }

  _parseAvds(emulatorOutput: string): Array<string> {
    const trimmedOutput = emulatorOutput.trim();
    return trimmedOutput === '' ? [] : trimmedOutput.split(os.EOL);
  }

  async _populateAvdPID(avdName: string): Promise<Avd> {
    const lockFile = `${AVD_DIRECTORY}/${avdName}.avd/${AVD_LOCKFILE}`;
    if (await fsPromise.exists(lockFile)) {
      const pid = parseInt(await fsPromise.readFile(lockFile, 'utf8'), 10);
      return {
        name: avdName,
        running: true,
        pid,
      };
    } else {
      return {
        name: avdName,
        running: false,
      };
    }
  }

  _populateAvdPIDs = (avds: Array<string>): Observable<Array<Avd>> => {
    return Observable.fromPromise(Promise.all(avds.map(this._populateAvdPID)));
  };

  _getAvds(): Observable<Expected<Array<Avd>>> {
    return this._getEmulator().switchMap(emulator => {
      return emulator != null
        ? runCommand(emulator, ['-list-avds'])
            .map(this._parseAvds)
            .switchMap(this._populateAvdPIDs)
            .map(Expect.value)
        : Observable.of(
            Expect.error(new Error("Cannot find 'emulator' command.")),
          );
    });
  }

  _refreshAvds = (): void => {
    this._refresh.next();
  };

  _startAvd = (avd: Avd): void => {
    track('nuclide-device-panel-android.start-emulator');
    invariant(this._emulator != null);
    // eslint-disable-next-line nuclide-internal/unused-subscription
    runCommand(this._emulator, ['@' + avd.name]).subscribe(
      stdout => {},
      err => {
        atom.notifications.addError(
          `Failed to start up emulator ${avd.name}.`,
          {
            detail: err,
            dismissable: true,
          },
        );
      },
    );
  };
}
