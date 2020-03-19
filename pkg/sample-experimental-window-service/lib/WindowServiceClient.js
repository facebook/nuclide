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

import type {ServiceConnection} from 'nuclide-commons-atom/experimental-packages/types';

import invariant from 'assert';
import {Observable} from 'rxjs';
import {getLogger} from 'log4js';

const logger = getLogger('sample-experimental-window-service.connectClient');

export type OpenParams<T> = {
  width: number,
  height: number,
  frame: boolean,
  view: {
    componentId: string,
    initialState: T,
  },
};

export type UpdateParams<U> = {
  id: number,
  update: U,
};

export type DestroyParams = {
  id: number,
};

type View<T, U> = {
  componentId: string,
  render(): T,
  +updates: Observable<U>,
  +dispose?: () => mixed,
  +handleAction?: (action: Object) => mixed, // TODO: Type action?
};

type WindowOptions<T, U> = {|
  width: number,
  height: number,
  frame?: boolean,
  createView: () => View<T, U>,
|};

type Window = {|
  destroy(): void,
|};

export default class WindowServiceClient {
  _connection: ServiceConnection;

  constructor(connection: ServiceConnection) {
    this._connection = connection;
  }

  open(options: WindowOptions<*, *>): Window {
    const view = options.createView();
    const idPromise = this._connection.sendRequest('open', {
      width: options.width,
      height: options.height,
      frame: options.frame,
      view: {
        componentId: view.componentId,
        initialState: view.render(),
      },
    });
    const updatesSubscription = Observable.fromPromise(idPromise)
      .switchMap(id =>
        view.updates.map(update => ({
          id,
          update: update == null ? view.render() : update,
        })),
      )
      .subscribe(params => {
        this._connection.sendNotification('update', params);
      });
    if (view.handleAction != null) {
      this._connection.onNotification(
        {method: 'dispatch'},
        ({action}: Object) => {
          logger.info(`client receiving action: ${JSON.stringify(action)}`);
          invariant(view.handleAction != null);
          view.handleAction(action);
        },
      );
    }
    return {
      destroy(): void {
        updatesSubscription.unsubscribe();
        if (view.dispose != null) {
          view.dispose();
        }
        idPromise.then(id => {
          this._connection.sendNotification('destroy', ({id}: DestroyParams));
        });
      },
    };
  }
}
