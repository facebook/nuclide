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

import type {NuxTriggerModel, NuxTriggerType} from './NuxModel';

import {track} from '../../nuclide-analytics';
import {maybeToString} from 'nuclide-commons/string';
import {NuxView} from './NuxView';

export class NuxTour {
  _nuxList: Array<NuxView>;
  _callback: ?() => void;
  _currentStep: number;
  _id: number;
  _name: string;
  _trigger: ?NuxTriggerModel;
  _gatekeeperID: ?string;

  constructor(
    id: number,
    name: string,
    nuxList: ?Array<NuxView>,
    trigger: ?NuxTriggerModel,
    gatekeeperID: ?string,
  ): void {
    if (nuxList == null || nuxList.length < 1) {
      throw new Error(
        'You must create a NuxTour with at least one NuxView element!',
      );
    }
    this._currentStep = 0;
    this._id = id;
    this._name = name;
    this._nuxList = nuxList;
    this._trigger = trigger;
    this._gatekeeperID = gatekeeperID;

    const boundNextStep = this._nextStep.bind(this);
    nuxList.forEach(n => {
      n.setNuxCompleteCallback(boundNextStep);
    });
  }

  getGatekeeperID(): ?string {
    return this._gatekeeperID;
  }

  begin(): void {
    try {
      this._nuxList[0].showNux();
    } catch (err) {
      this._track(false, (err: Error).toString());
    }
  }

  /**
   * Force the NUX tour to end. Used when a package or the NUX framework is deactivated.
   *
   * @param {boolean} shouldMarkAsCompleted - Whether or not to mark the NUX as completed.
   * If marked as completed, it will not be shown again.
   * To be used when the user dismisses the NUX and doesn't want to see it again.
   */
  forceEnd(shouldMarkAsCompleted: boolean = false): void {
    if (shouldMarkAsCompleted) {
      this._track(true, 'NuxTour was dismissed by the user.');
    } else {
      this._track(false, 'NuxTour was forcibly ended.');
    }
    this._nuxList[this._currentStep].dispose();
    // Skip remaining NUXes. No disposal is needed since they are lazily instantiated.
    this._onNuxComplete(shouldMarkAsCompleted);
  }

  _nextStep(stepWasSuccesful: boolean): void {
    if (!stepWasSuccesful) {
      // Mark the NUX as completed, since the step was exited prematurely (skipped)
      this.forceEnd(true);
    } else if (this._currentStep < this._nuxList.length - 1) {
      this._track(true);
      try {
        this._nuxList[++this._currentStep].showNux();
      } catch (err) {
        this._track(false, (err: Error).toString());
      }
    } else {
      this._onNuxComplete();
    }
  }

  _onNuxComplete(completionSuccesful: boolean = true): void {
    this._track(completionSuccesful);
    if (this._callback != null) {
      this._callback();
    }
  }

  _track(completed: boolean = false, error: ?string): void {
    track('nux-tour-action', {
      tourId: this._id,
      tourName: this._name,
      step: `${this._currentStep + 1}/${this._nuxList.length + 1}`,
      completed: `${completed.toString()}`,
      error: maybeToString(error),
    });
  }

  setNuxCompleteCallback(callback: () => void): void {
    this._callback = callback;
  }

  isReady(editor: atom$TextEditor): boolean {
    return this._trigger != null ? this._trigger.triggerCallback(editor) : true;
  }

  getTriggerType(): ?NuxTriggerType {
    return this._trigger != null ? this._trigger.triggerType : null;
  }

  getID(): number {
    return this._id;
  }

  getName(): string {
    return this._name;
  }
}
