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

import type {
  Opener,
  OpenOptions,
  SerializedAppState,
  Store,
  ToggleOptions,
  Viewable,
  WorkspaceViewsService,
} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {
  getDocksWorkspaceViewsService,
} from 'nuclide-commons-atom/workspace-views-compat';
import {
  combineEpics,
  createEpicMiddleware,
} from '../../commons-node/redux-observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {nextTick} from 'nuclide-commons/observable';
import {getLogger} from 'log4js';
import * as AppSerialization from './AppSerialization';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import * as Reducers from './redux/Reducers';
import invariant from 'assert';
import {Disposable} from 'atom';
import {applyMiddleware, combineReducers, createStore} from 'redux';

class Activation {
  _disposables: UniversalDisposable;
  _needToDispatchActivatedAction: boolean;
  _store: Store;
  _rawState: ?Object;

  constructor(rawState: ?Object) {
    this._needToDispatchActivatedAction = false;

    this._disposables = new UniversalDisposable(
      // We don't know if this package is being activated as part of Atom's initial package
      // activation phase or being enabled through the settings later (in which case we would have
      // missed the `onDidActivatePackage` event).
      observableFromSubscribeFunction(cb =>
        atom.packages.onDidActivatePackage(cb),
      )
        .race(nextTick)
        .first()
        .subscribe(() => {
          this._needToDispatchActivatedAction = true;
          this._maybeDispatchActivatedAction();
        }),
    );
    this._rawState = rawState;
  }

  _maybeDispatchActivatedAction(): void {
    if (this._needToDispatchActivatedAction && this._store != null) {
      this._needToDispatchActivatedAction = false;
      this._store.dispatch(Actions.didActivateInitialPackages());
    }
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _getStore(): Store {
    if (this._store == null) {
      this._store = createPackageStore(this._rawState || {});
      this._rawState = null;
      this._maybeDispatchActivatedAction();
    }
    return this._store;
  }

  serialize(): SerializedAppState {
    return AppSerialization.serialize(this._store.getState());
  }

  provideWorkspaceViewsService(): WorkspaceViewsService {
    let pkg = this; // eslint-disable-line consistent-this
    this._disposables.add(() => {
      pkg = null;
    });

    return {
      registerLocation: locationFactory => {
        invariant(pkg != null, 'Viewables API used after deactivation');
        pkg
          ._getStore()
          .dispatch(Actions.registerLocationFactory(locationFactory));
        return new Disposable(() => {
          if (pkg != null) {
            pkg
              ._getStore()
              .dispatch(Actions.unregisterLocation(locationFactory.id));
          }
        });
      },
      addOpener(opener: Opener): IDisposable {
        invariant(pkg != null, 'Viewables API used after deactivation');
        pkg._getStore().dispatch(Actions.addOpener(opener));
        return new Disposable(() => {
          if (pkg != null) {
            pkg._getStore().dispatch(Actions.removeOpener(opener));
          }
        });
      },
      destroyWhere(predicate: (item: Viewable) => boolean) {
        if (pkg == null) {
          return;
        }
        pkg._getStore().dispatch(Actions.destroyWhere(predicate));
      },
      open(uri: string, options?: OpenOptions): void {
        invariant(pkg != null, 'Viewables API used after deactivation');
        pkg._getStore().dispatch(Actions.open(uri, options));
      },
      toggle(uri: string, options?: ?ToggleOptions): void {
        invariant(pkg != null, 'Viewables API used after deactivation');
        const visible = options != null ? options.visible : undefined;
        pkg._getStore().dispatch(Actions.toggleItemVisibility(uri, visible));
      },
    };
  }
}

// TODO(matthewwithanm): Delete this (along with the services and package) and refactor to workspace
// API once docks land
class CompatActivation {
  provideWorkspaceViewsService(): WorkspaceViewsService {
    return getDocksWorkspaceViewsService();
  }
}

function createPackageStore(rawState: Object): Store {
  const initialState = AppSerialization.deserialize(rawState);
  const epics = Object.keys(Epics)
    .map(k => Epics[k])
    .filter(epic => typeof epic === 'function');
  const rootEpic = (actions, store) =>
    combineEpics(...epics)(actions, store)
      // Log errors and continue.
      .catch((err, stream) => {
        getLogger('nuclide-workspace-views').error(err);
        return stream;
      });
  const store = createStore(
    combineReducers(Reducers),
    initialState,
    applyMiddleware(createEpicMiddleware(rootEpic)),
  );

  return store;
}

if (
  typeof atom.workspace.getLeftDock === 'function' &&
  typeof atom.workspace.toggle === 'function'
) {
  createPackage(module.exports, CompatActivation);
} else {
  createPackage(module.exports, Activation);
}
