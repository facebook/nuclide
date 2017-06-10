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

import type {SwiftPMTaskRunnerStoreState} from './SwiftPMTaskRunnerStoreState';
import type SwiftPMTaskRunnerDispatcher from './SwiftPMTaskRunnerDispatcher';

import {objectEntries, objectFromMap} from 'nuclide-commons/collection';
import {Emitter} from 'atom';
import {ActionTypes} from './SwiftPMTaskRunnerDispatcher';

export default class SwiftPMTaskRunnerStore {
  _dispatcher: SwiftPMTaskRunnerDispatcher;
  _emitter: Emitter;
  _configuration: string;
  _buildPath: string;
  _flag: string;
  _Xcc: string;
  _Xlinker: string;
  _Xswiftc: string;
  _compileCommands: Map<string, string>;
  _projectRoot: ?string;

  constructor(
    dispatcher: SwiftPMTaskRunnerDispatcher,
    initialState: ?SwiftPMTaskRunnerStoreState,
  ) {
    this._dispatcher = dispatcher;
    this._emitter = new Emitter();

    if (initialState) {
      this._configuration = initialState.configuration
        ? initialState.configuration
        : 'debug';
      this._buildPath = initialState.buildPath ? initialState.buildPath : '';
      this._Xcc = initialState.Xcc ? initialState.Xcc : '';
      this._Xlinker = initialState.Xlinker ? initialState.Xlinker : '';
      this._Xswiftc = initialState.Xswiftc ? initialState.Xswiftc : '';
      this._compileCommands = initialState.compileCommands
        ? new Map(objectEntries(initialState.compileCommands))
        : new Map();
    } else {
      this._configuration = 'debug';
      this._buildPath = '';
      this._Xcc = '';
      this._Xlinker = '';
      this._Xswiftc = '';
      this._compileCommands = new Map();
    }

    this._dispatcher.register(action => {
      switch (action.actionType) {
        case ActionTypes.UPDATE_PROJECT_ROOT:
          this._projectRoot = action.projectRoot;
          break;
        case ActionTypes.UPDATE_SETTINGS:
          this._configuration = action.configuration;
          this._Xcc = action.Xcc;
          this._Xlinker = action.Xlinker;
          this._Xswiftc = action.Xswiftc;
          this._buildPath = action.buildPath;
          break;
        case ActionTypes.UPDATE_COMPILE_COMMANDS:
          this._compileCommands = action.compileCommands;
          break;
      }
      this.emitChange();
    });
  }

  dispose() {
    this._emitter.dispose();
  }

  serialize(): SwiftPMTaskRunnerStoreState {
    return {
      configuration: this.getConfiguration(),
      buildPath: this.getBuildPath(),
      Xcc: this.getXcc(),
      Xlinker: this.getXlinker(),
      Xswiftc: this.getXswiftc(),
      compileCommands: objectFromMap(this.getCompileCommands()),
    };
  }

  subscribe(callback: () => void): IDisposable {
    return this._emitter.on('change', callback);
  }

  emitChange(): void {
    this._emitter.emit('change');
  }

  getConfiguration(): string {
    return this._configuration;
  }

  getBuildPath(): string {
    return this._buildPath;
  }

  getProjectRoot(): ?string {
    return this._projectRoot;
  }

  getFlag(): string {
    return this._flag;
  }

  getXcc(): string {
    return this._Xcc;
  }

  getXlinker(): string {
    return this._Xlinker;
  }

  getXswiftc(): string {
    return this._Xswiftc;
  }

  getCompileCommands(): Map<string, string> {
    return this._compileCommands;
  }
}
