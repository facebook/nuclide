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

import type {LinterMessageV2} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {BehaviorSubject, ReplaySubject} from 'rxjs';
import * as React from 'react';
import uuid from 'uuid';

export type addMessageOption = {
  getBlockComponent?: () => React.ComponentType<any>,
};

export default class PackageModel {
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _disposed = new ReplaySubject(1);
  _element: ?HTMLElement;
  _messages: BehaviorSubject<Array<LinterMessageV2>> = new BehaviorSubject([]);

  dispose(): void {
    this._disposed.next();
  }

  addMessages = (
    severity: 'error' | 'warning' | 'info',
    count: number = 1,
    kind?: 'review',
    option?: ?addMessageOption,
  ) => {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) {
      atom.notifications.addError("There's no active text editor.");
      return;
    }
    const path = editor.getPath();
    if (path == null) {
      atom.notifications.addError('The active editor must be saved.');
      return;
    }

    const position = editor.getSelectedBufferRange();
    const newMessages = [];
    for (let i = 0; i < count; i++) {
      newMessages.push({
        id: option ? uuid.v4() : null,
        location: {
          file: path,
          position,
        },
        kind,
        excerpt: 'Here is an excerpt of the error',
        description:
          'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        severity,
        getBlockComponent: option ? option.getBlockComponent : null,
      });
    }
    this._messages.next([...this._messages.getValue(), ...newMessages]);
  };

  changeMessageLine = (): void => {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) {
      atom.notifications.addError("There's no active text editor.");
      return;
    }
    const position = editor.getSelectedBufferRange();
    const newMessages = this._messages.getValue().map(message => {
      return {
        ...message,
        location: {...message.location, position},
      };
    });
    this._messages.next(newMessages);
  };

  changeMessageContent = (): void => {
    const newMessages = this._messages.getValue().map(message => {
      return {
        ...message,
        getBlockComponent() {
          return NewBlockComponent;
        },
      };
    });
    this._messages.next(newMessages);
  };

  clear = (): void => {
    this._messages.next([]);
  };

  observeMessages(
    callback: (messages: Array<LinterMessageV2>) => mixed,
  ): IDisposable {
    return new UniversalDisposable(
      this._messages
        .distinctUntilChanged()
        .takeUntil(this._disposed)
        .subscribe(messages => {
          callback(messages);
        }),
    );
  }
}

class NewBlockComponent extends React.Component<{}> {
  render() {
    return (
      <div>
        <h1>Content Changed</h1>
      </div>
    );
  }
}
