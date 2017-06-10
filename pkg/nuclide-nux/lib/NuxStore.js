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

/* global localStorage */

import {Emitter} from 'atom';

import type {NuxTourModel} from './NuxModel';

const NEW_NUX_EVENT = 'newNuxModel';

export const NUX_SAVED_STORE = 'nuclide-nux.saved-nux-data-store';

export class NuxStore {
  _emitter: atom$Emitter;
  // Maps a Nux's unique ID to the boolean representing its viewed state
  _nuxMap: Map<number, boolean>;

  constructor(): void {
    this._nuxMap = new Map();
    this._emitter = new Emitter();
  }

  dispose(): void {
    this._emitter.dispose();
  }

  // Load the saved NUX statuses. Reads serialized values from backend and local caches
  // and generates a map of NUX states by ID by merging the two values.
  initialize(): void {
    // Get the NUX backend cached information; stub for OSS friendliness
    let NuxBackendCache;
    try {
      // This inline import won't affect performance since we only call it once per NuxStore.
      // $FlowFB
      NuxBackendCache = require('./fb-NuxCache').NuxCache;
    } catch (e) {
      NuxBackendCache = class {
        getNuxStatus(): Map<number, boolean> {
          return new Map();
        }
      };
    }

    const nuclideNuxState = new Map(
      // $FlowIgnore: null is ok here
      JSON.parse(localStorage.getItem(NUX_SAVED_STORE)),
    );
    const fbNuxState = new NuxBackendCache().getNuxStatus();

    // Merge the two maps. If a key exists in both input maps, the value from
    // the latter (backend cache) will be used in the resulting map.
    this._nuxMap = new Map([...nuclideNuxState, ...fbNuxState]);
  }

  /*
   * Try to add the NUX to the list of registered NUXes.
   */
  addNewNux(nux: NuxTourModel): void {
    const nuxState = this._nuxMap.get(nux.id);
    // if `developmentMode` is set, the NUX will be shown during EVERY session.
    // This is used to make debugging easier.
    if (nuxState && !nux.developmentMode) {
      return;
    }
    this._nuxMap.set(nux.id, false);
    this._emitter.emit(NEW_NUX_EVENT, nux);
  }

  serialize(): void {
    this._saveNuxState();
  }

  _saveNuxState(): void {
    localStorage.setItem(NUX_SAVED_STORE, JSON.stringify([...this._nuxMap]));
  }

  /**
   * Register a change handler that is invoked whenever the store changes.
   */
  onNewNux(callback: (nux: NuxTourModel) => void): IDisposable {
    return this._emitter.on(NEW_NUX_EVENT, callback);
  }

  onNuxCompleted(nuxModel: NuxTourModel): void {
    if (!this._nuxMap.has(nuxModel.id)) {
      return;
    }
    this._nuxMap.set(nuxModel.id, /* completed */ true);
    this._saveNuxState();
  }
}
