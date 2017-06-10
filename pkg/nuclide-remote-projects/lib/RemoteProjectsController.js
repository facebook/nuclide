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

import invariant from 'assert';
import {ServerConnection} from '../../nuclide-remote-connection';
import React from 'react';
import ReactDOM from 'react-dom';
import {CompositeDisposable, Disposable} from 'atom';
import StatusBarTile from './StatusBarTile';
import {isValidTextEditor} from 'nuclide-commons-atom/text-editor';
import nuclideUri from 'nuclide-commons/nuclideUri';
import ConnectionState from './ConnectionState';

export default class RemoteProjectsController {
  _disposables: CompositeDisposable;
  _statusBarDiv: ?HTMLElement;
  _statusBarTile: ?StatusBarTile;
  _statusSubscription: ?IDisposable;

  constructor() {
    this._statusBarTile = null;
    this._disposables = new CompositeDisposable();

    this._statusSubscription = null;
    this._disposables.add(
      atom.workspace.onDidChangeActivePaneItem(
        this._disposeSubscription.bind(this),
      ),
      atom.workspace.onDidStopChangingActivePaneItem(
        this._updateConnectionStatus.bind(this),
      ),
    );
  }

  _disposeSubscription(): void {
    const subscription = this._statusSubscription;
    if (subscription) {
      this._disposables.remove(subscription);
      subscription.dispose();
      this._statusSubscription = null;
    }
  }

  _updateConnectionStatus(paneItem: mixed): void {
    this._disposeSubscription();

    if (!isValidTextEditor(paneItem)) {
      this._renderStatusBar(ConnectionState.NONE);
      return;
    }
    // Flow does not understand that isTextEditor refines the type to atom$TextEditor
    const textEditor = ((paneItem: any): atom$TextEditor);
    const fileUri = textEditor.getPath();
    if (!fileUri) {
      return;
    }
    if (nuclideUri.isLocal(fileUri)) {
      this._renderStatusBar(ConnectionState.LOCAL, fileUri);
      return;
    }

    const updateStatus = isConnected => {
      this._renderStatusBar(
        isConnected ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
        fileUri,
      );
    };

    const connection = ServerConnection.getForUri(fileUri);
    if (connection == null) {
      updateStatus(false);
      return;
    }

    const socket = connection.getSocket();
    updateStatus(socket.isConnected());

    this._statusSubscription = socket.onStatus(updateStatus);
    this._disposables.add(this._statusSubscription);
  }

  consumeStatusBar(statusBar: atom$StatusBar): void {
    this._statusBarDiv = document.createElement('div');
    this._statusBarDiv.className = 'nuclide-remote-projects inline-block';

    const tooltip = atom.tooltips.add(this._statusBarDiv, {
      title: 'Click to show details of connection.',
    });
    invariant(this._statusBarDiv);
    const rightTile = statusBar.addLeftTile({
      item: this._statusBarDiv,
      priority: -99,
    });

    this._disposables.add(
      new Disposable(() => {
        invariant(this._statusBarDiv);
        const parentNode = this._statusBarDiv.parentNode;
        if (parentNode) {
          parentNode.removeChild(this._statusBarDiv);
        }
        ReactDOM.unmountComponentAtNode(this._statusBarDiv);
        this._statusBarDiv = null;
        rightTile.destroy();
        tooltip.dispose();
      }),
    );

    const textEditor = atom.workspace.getActiveTextEditor();
    if (textEditor != null) {
      this._updateConnectionStatus(textEditor);
    }
  }

  _renderStatusBar(connectionState: number, fileUri?: string): void {
    if (!this._statusBarDiv) {
      return;
    }

    const component = ReactDOM.render(
      <StatusBarTile connectionState={connectionState} fileUri={fileUri} />,
      this._statusBarDiv,
    );
    invariant(component instanceof StatusBarTile);
    this._statusBarTile = component;
  }

  destroy(): void {
    this._disposables.dispose();
  }
}
