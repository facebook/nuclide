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

import type {AttachTargetInfo} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import type LaunchAttachDispatcher, {
  LaunchAttachAction,
} from './LaunchAttachDispatcher';

import {Emitter} from 'atom';
import {ActionTypes} from './LaunchAttachDispatcher';

const ATTACH_TARGET_LIST_CHANGE_EVENT = 'ATTACH_TARGET_LIST_CHANGE_EVENT';

export class LaunchAttachStore {
  _dispatcher: LaunchAttachDispatcher;
  _dispatcherToken: string;
  _attachTargetInfos: Array<AttachTargetInfo>;
  _emitter: Emitter;

  constructor(dispatcher: LaunchAttachDispatcher) {
    this._dispatcher = dispatcher;
    this._dispatcherToken = this._dispatcher.register(
      this._handleActions.bind(this),
    );
    this._emitter = new Emitter();
    this._attachTargetInfos = [];
  }

  dispose() {
    this._dispatcher.unregister(this._dispatcherToken);
  }

  onAttachTargetListChanged(callback: () => void): IDisposable {
    return this._emitter.on(ATTACH_TARGET_LIST_CHANGE_EVENT, callback);
  }

  _handleActions(action: LaunchAttachAction): void {
    switch (action.actionType) {
      case ActionTypes.UPDATE_ATTACH_TARGET_LIST:
        this._attachTargetInfos = action.attachTargetInfos;
        this._emitter.emit(ATTACH_TARGET_LIST_CHANGE_EVENT);
        break;
    }
  }

  getAttachTargetInfos(): Array<AttachTargetInfo> {
    return this._attachTargetInfos;
  }
}
