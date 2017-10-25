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

import {Disposable, Emitter} from 'atom';

import {isValidTextEditor} from 'nuclide-commons-atom/text-editor';
import {arrayCompact} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {isGkEnabled, onceGkInitialized} from '../../commons-node/passesGK';
import {maybeToString} from 'nuclide-commons/string';

import {getLogger} from 'log4js';
import {track} from '../../nuclide-analytics';

import {NuxStore} from './NuxStore';
import {NuxTour} from './NuxTour';
import {NuxView} from './NuxView';

import type {NuxTourModel} from './NuxModel';
import type {SyncCompletedNux} from './main';

// Limits the number of NUXes displayed every session
const NUX_PER_SESSION_LIMIT = 3;
const NEW_TOUR_EVENT = 'nuxTourNew';
const READY_TOUR_EVENT = 'nuxTourReady';

const logger = getLogger('nuclide-nux');

export class NuxManager {
  _nuxStore: NuxStore;
  _disposables: UniversalDisposable;
  _emitter: atom$Emitter;
  _activeNuxTour: ?NuxTour;
  // Maps a NUX's unique ID to its corresponding NuxTour
  // Registered NUXes that are waiting to be triggered
  _pendingNuxes: Map<number, NuxTour>;
  // Triggered NUXes that are waiting to be displayed
  _readyToDisplayNuxes: Array<NuxTour>;
  _numNuxesDisplayed: number;
  _syncCompletedNux: SyncCompletedNux;

  constructor(nuxStore: NuxStore, syncCompletedNux: SyncCompletedNux): void {
    this._nuxStore = nuxStore;
    this._syncCompletedNux = syncCompletedNux;

    this._emitter = new Emitter();
    this._disposables = new UniversalDisposable();

    this._pendingNuxes = new Map();
    this._readyToDisplayNuxes = [];
    this._activeNuxTour = null;
    this._numNuxesDisplayed = 0;

    this._emitter.on(NEW_TOUR_EVENT, this._handleNewTour.bind(this));
    this._emitter.on(READY_TOUR_EVENT, this._handleReadyTour.bind(this));

    this._disposables.add(
      this._nuxStore.onNewNux(this._handleNewNux.bind(this)),
    );
    this._disposables.add(
      atom.workspace.onDidStopChangingActivePaneItem(
        this._handleActivePaneItemChanged.bind(this),
      ),
    );

    this._nuxStore.initialize();
  }

  // Routes new NUX through the NuxStore so that the store can deal with
  // registering of previously completed or existing NUXes.
  addNewNux(nux: NuxTourModel): Disposable {
    this._nuxStore.addNewNux(nux);
    return new Disposable(() => {
      this._removeNux(nux.id);
    });
  }

  _removeNux(id: number): void {
    if (this._activeNuxTour != null && this._activeNuxTour.getID() === id) {
      this._activeNuxTour.forceEnd();
      return;
    }
    this._pendingNuxes.delete(id);
    this._removeNuxFromList(this._readyToDisplayNuxes, id);
  }

  _removeNuxFromList(list: Array<NuxTour>, id: number): void {
    for (let i = 0; i < list.length; i++) {
      if (list[i].getID() === id) {
        list.splice(i--, 1);
        return;
      }
    }
  }

  // Handles new NUXes emitted from the store
  _handleNewNux(nuxTourModel: NuxTourModel): void {
    const nuxViews = arrayCompact(
      nuxTourModel.nuxList.map((model, index, arr) => {
        try {
          return new NuxView(
            nuxTourModel.id,
            model.selector,
            model.selectorFunction,
            model.position,
            model.content,
            model.completionPredicate,
            index,
            arr.length, // Number of NuxViewModels in the NuxTourModel
          );
        } catch (err) {
          const error = `NuxView #${index} for "${nuxTourModel.id}" failed to instantiate.`;
          logger.error(`ERROR: ${error}`);
          this._track(
            nuxTourModel.id,
            nuxTourModel.name,
            `NuxView #${index + 1} failed to instantiate.`,
            err.toString(),
          );
          return null;
        }
      }),
    );

    const nuxTour = new NuxTour(
      nuxTourModel.id,
      nuxTourModel.name,
      nuxViews,
      nuxTourModel.trigger,
      nuxTourModel.gatekeeperID,
    );

    this._emitter.emit(NEW_TOUR_EVENT, {
      nuxTour,
      nuxTourModel,
    });
  }

  _handleNuxCompleted(nuxTourModel: NuxTourModel): void {
    this._activeNuxTour = null;
    this._nuxStore.onNuxCompleted(nuxTourModel);
    this._syncCompletedNux(nuxTourModel.id);
    if (this._readyToDisplayNuxes.length === 0) {
      return;
    }
    const nextNux = this._readyToDisplayNuxes.shift();
    this._emitter.emit(READY_TOUR_EVENT, nextNux);
  }

  // Handles NUX registry
  _handleNewTour(value: any) {
    const {nuxTour, nuxTourModel} = value;

    nuxTour.setNuxCompleteCallback(
      this._handleNuxCompleted.bind(this, nuxTourModel),
    );

    this._pendingNuxes.set(nuxTour.getID(), nuxTour);
  }

  // Handles triggered NUXes that are ready to be displayed
  _handleReadyTour(nuxTour: NuxTour): void {
    if (
      this._activeNuxTour == null &&
      this._numNuxesDisplayed < NUX_PER_SESSION_LIMIT
    ) {
      this._numNuxesDisplayed++;
      this._activeNuxTour = nuxTour;
      nuxTour.begin();
      this._track(nuxTour.getID(), nuxTour.getName(), 'Triggered new nux');
    } else {
      this._readyToDisplayNuxes.push(nuxTour);
    }
  }

  /*
   * An internal function that tries to trigger a NUX if its trigger type is
   * 'editor' and its `isReady` function returns to `true`.
   * Called every time the active pane item changes.
   */
  async _handleActivePaneItemChanged(paneItem: ?mixed): Promise<void> {
    // The `paneItem` is not guaranteed to be an instance of `TextEditor` from
    // Atom's API, but usually is.  We return if the type is not `TextEditor`
    // since `NuxTour.isReady` expects a `TextEditor` as its argument.
    if (!isValidTextEditor(paneItem)) {
      return;
    }
    // Flow doesn't understand the refinement done above.
    const textEditor: atom$TextEditor = (paneItem: any);

    for (const [id: string, nux: NuxTour] of this._pendingNuxes.entries()) {
      if (nux.getTriggerType() !== 'editor' || !nux.isReady(textEditor)) {
        continue;
      }
      // Remove NUX from pending list.
      this._pendingNuxes.delete(id);
      // We do the above regardless of whether the following GK checks pass/fail
      // to avoid repeating the checks again.
      const gkID = nux.getGatekeeperID();
      try {
        // Disable the linter suggestion to use `Promise.all` as we want to trigger NUXes
        // as soon as each promise resolves rather than waiting for them all to.
        // eslint-disable-next-line no-await-in-loop
        if (await this._canTriggerNux(gkID)) {
          this._emitter.emit(READY_TOUR_EVENT, nux);
        }
      } catch (err) {
        // Errors if the NuxManager was disposed while awaiting the result
        // so we don't search the rest of the list.
        return;
      }
    }
  }

  /*
   * A function exposed externally via a service that tries to trigger a NUX.
   */
  async tryTriggerNux(id: number): Promise<void> {
    const nuxToTrigger = this._pendingNuxes.get(id);
    // Silently fail if the NUX is not found. This isn't an "error" to log, since the NUX
    // may be triggered again even after it has been seen, but should only be shown once.
    if (nuxToTrigger == null) {
      return;
    }

    // Remove NUX from pending list.
    this._pendingNuxes.delete(id);
    // We do the above regardless of whether the following GK checks pass/fail
    // to avoid repeating the checks again.
    const gkID = nuxToTrigger.getGatekeeperID();
    try {
      if (await this._canTriggerNux(gkID)) {
        this._emitter.emit(READY_TOUR_EVENT, nuxToTrigger);
      }
    } catch (err) {}
  }

  /*
   * Given a NUX-specific GK, determines whether the NUX can be displayed to the user.
   *
   * @return {Promise<boolean>} A promise that rejects if the manager disposes when waiting
   *  on GKs, or resolves a boolean describing whether or not the NUX should be displayed.
   */
  _canTriggerNux(gkID: ?string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const cleanupDisposable = new Disposable(() => {
        gkDisposable.dispose();
        reject(new Error('NuxManager was disposed while waiting on GKs.'));
      });
      const gkDisposable = onceGkInitialized(() => {
        // Only show the NUX if
        //  a) the user is an OSS user OR
        //  b) the user is an internal user and passes the `nuclide_all_nuxes` GK AND
        //     i) either there is no NUX-specific GK OR
        //    ii) there is a NUX-specific GK and the user passes it
        const shouldShowNuxes = isGkEnabled('cpe_nuclide')
          ? isGkEnabled('nuclide_all_nuxes') &&
            (gkID == null || isGkEnabled(gkID))
          : true;

        // No longer need to cleanup
        this._disposables.remove(cleanupDisposable);
        this._disposables.remove(gkDisposable);

        // `isGkEnabled` returns a nullable boolean, so check for strict equality
        resolve(shouldShowNuxes === true);
      });
      this._disposables.add(gkDisposable, cleanupDisposable);
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _track(
    tourId: number,
    tourName: string,
    message: string,
    error: ?string = null,
  ): void {
    track('nux-manager-action', {
      tourId,
      tourName,
      message: `${message}`,
      error: maybeToString(error),
    });
  }
}
