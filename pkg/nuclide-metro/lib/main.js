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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {ConsoleService} from 'atom-ide-ui';
import type {MetroAtomService} from './types';
import type {TunnelBehavior} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {BehaviorSubject} from 'rxjs';
import {DefaultMetroAtomService} from './DefaultMetroAtomService';

class Activation {
  _projectRootPath: BehaviorSubject<?NuclideUri>;
  _disposables: UniversalDisposable;
  _metroAtomService: DefaultMetroAtomService;

  constructor(serializedState: ?Object) {
    this._projectRootPath = new BehaviorSubject(null);
    this._metroAtomService = new DefaultMetroAtomService(this._projectRootPath);

    this._disposables = new UniversalDisposable(
      this._metroAtomService,
      atom.commands.add('atom-workspace', {
        // Ideally based on CWD, the commands can be disabled and the UI would explain why.
        'nuclide-metro:start': async (event: {
          detail: ?{
            port?: number,
            tunnelBehavior?: TunnelBehavior,
            extraArgs?: Array<string>,
          },
        }) => {
          const detail = event.detail || {};
          try {
            await this._metroAtomService.start(
              detail.tunnelBehavior || 'ask_about_tunnel',
              detail.port,
              detail.extraArgs,
            );
          } catch (e) {}
        },
        'nuclide-metro:stop': () => this._metroAtomService.stop(),
        'nuclide-metro:restart': () => this._metroAtomService.restart(),
        'nuclide-metro:reload-app': () => this._metroAtomService.reloadApp(),
      }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  provideMetroAtomService(): MetroAtomService {
    return this._metroAtomService;
  }

  consumeCwdApi(api: CwdApi): void {
    this._disposables.add(
      api.observeCwd(dir => {
        this._projectRootPath.next(dir);
      }),
    );
  }

  consumeConsole(consoleService: ConsoleService): IDisposable {
    let consoleApi = consoleService({
      id: 'Metro',
      name: 'Metro',
      start: () => {
        this._metroAtomService.start('ask_about_tunnel').catch(() => {});
      },
      stop: () => this._metroAtomService.stop(),
    });
    const disposable = new UniversalDisposable(
      () => {
        consoleApi != null && consoleApi.dispose();
        consoleApi = null;
      },
      this._metroAtomService._logTailer
        .getMessages()
        .subscribe(message => consoleApi != null && consoleApi.append(message)),
      this._metroAtomService.observeStatus(status => {
        if (consoleApi != null) {
          consoleApi.setStatus(status);
        }
      }),
    );
    this._disposables.add(disposable);
    return disposable;
  }
}

createPackage(module.exports, Activation);
