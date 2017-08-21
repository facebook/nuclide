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

import type {SshTunnelService, Store} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {TunnelsPanel, WORKSPACE_VIEW_URI} from './ui/TunnelsPanel';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import * as Reducers from './redux/Reducers';
import {applyMiddleware, combineReducers, createStore} from 'redux';
import {
  combineEpics,
  createEpicMiddleware,
} from 'nuclide-commons/redux-observable';
import {Disposable} from 'atom';

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;

  constructor(rawState: ?Object) {
    const epics = Object.keys(Epics)
      .map(k => Epics[k])
      .filter(epic => typeof epic === 'function');
    this._store = createStore(
      combineReducers(Reducers),
      applyMiddleware(createEpicMiddleware(combineEpics(...epics))),
    );

    this._disposables = new UniversalDisposable(
      this._closeAllTunnels.bind(this),
      this._registerCommandAndOpener(),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  _registerCommandAndOpener(): UniversalDisposable {
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return new TunnelsPanel(this._store);
        }
      }),
      () => destroyItemWhere(item => item instanceof TunnelsPanel),
      atom.commands.add(
        'atom-workspace',
        'nuclide-ssh-tunnels-panel:toggle',
        () => {
          atom.workspace.toggle(WORKSPACE_VIEW_URI);
        },
      ),
    );
  }

  provideSshTunnelService(): SshTunnelService {
    return {
      openTunnel: (tunnel, onOpen, onClose) => {
        this._store.dispatch(Actions.openTunnel(tunnel, onOpen, onClose));
        return new Disposable(() =>
          this._store.dispatch(Actions.closeTunnel(tunnel)),
        );
      },
    };
  }

  deserializeSshTunnelsPanel(): atom$PaneItem {
    return new TunnelsPanel(this._store);
  }

  _closeAllTunnels() {
    const tunnels = this._store.getState().openTunnels;
    tunnels.forEach((_, tunnel) =>
      this._store.dispatch(Actions.closeTunnel(tunnel)),
    );
  }
}

createPackage(module.exports, Activation);
