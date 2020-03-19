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

import type {Store, BoundActionCreators, PartialAppState} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {RequestEditDialog} from './RequestEditDialog';
import {applyMiddleware, bindActionCreators, createStore} from 'redux';
import * as Actions from './Actions';
import * as Epics from './Epics';
import * as Reducers from './Reducers';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {track} from 'nuclide-analytics';

export type HttpRequestSenderApi = {
  updateRequestEditDialogDefaults(defaults: PartialAppState): void,
};

class Activation {
  _disposables: UniversalDisposable;
  _requestEditDialog: ?atom$Panel;
  _store: Store;
  _actionCreators: BoundActionCreators;

  constructor(): void {
    const initialState = {
      uri: 'example.com',
      method: 'GET',
      headers: {
        cookie: '',
      },
      body: null,
      parameters: [{key: '', value: ''}],
    };
    const rootEpic = combineEpicsFromImports(
      Epics,
      'nuclide-http-request-sender',
    );
    this._store = createStore(
      Reducers.app,
      initialState,
      applyMiddleware(createEpicMiddleware(rootEpic)),
    );
    this._actionCreators = bindActionCreators(Actions, this._store.dispatch);
    this._requestEditDialog = null;
    this._disposables = new UniversalDisposable(
      atom.commands.add('atom-workspace', {
        'nuclide-http-request-sender:toggle-http-request-edit-dialog': () => {
          track('nuclide-http-request-sender:toggle-http-request-edit-dialog');
          this._toggleRequestEditDialog();
        },
        'nuclide-http-request-sender:send-http-request': () => {
          track('nuclide-http-request-sender:send-http-request');
          this._actionCreators.sendHttpRequest();
        },
      }),
    );
  }

  _toggleRequestEditDialog(): void {
    const dialog = this._createModalIfNeeded();
    if (dialog.isVisible()) {
      dialog.hide();
    } else {
      dialog.show();
    }
  }

  _createModalIfNeeded(): atom$Panel {
    if (this._requestEditDialog != null) {
      return this._requestEditDialog;
    }
    const BoundEditDialog = bindObservableAsProps(
      observableFromReduxStore(this._store),
      RequestEditDialog,
    );
    const container = document.createElement('div');
    const requestEditDialog = atom.workspace.addModalPanel({
      item: container,
      visible: false,
    });
    ReactDOM.render(
      <BoundEditDialog actionCreators={this._actionCreators} />,
      container,
    );
    this._disposables.add(
      new UniversalDisposable(() => {
        requestEditDialog.destroy();
        this._requestEditDialog = null;
        ReactDOM.unmountComponentAtNode(container);
      }),
    );
    this._requestEditDialog = requestEditDialog;
    return requestEditDialog;
  }

  provideHttpRequestSender(): HttpRequestSenderApi {
    return {
      updateRequestEditDialogDefaults: this._actionCreators.updateState,
    };
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
