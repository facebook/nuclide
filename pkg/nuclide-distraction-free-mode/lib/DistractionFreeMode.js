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

import type {DistractionFreeModeProvider, DistractionFreeModeState} from '..';

import invariant from 'assert';
import {Disposable} from 'atom';

export class DistractionFreeMode {
  _providers: Set<DistractionFreeModeProvider>;
  // Non-null iff we have entered distraction-free mode without explicitly exiting it. See
  // _shouldRestore() and _enterDistractionFreeMode() for a more detailed explanation.
  _restoreState: ?Set<DistractionFreeModeProvider>;

  // Set of names for providers that were hidden when Nuclide last exited, but have not yet been
  // consumed.
  _deserializationState: ?Set<string>;

  constructor(state: ?DistractionFreeModeState) {
    this._providers = new Set();
    this._restoreState = null;
    if (state != null && state.restoreState != null) {
      this._deserializationState = new Set(state.restoreState);
    }
  }

  serialize(): DistractionFreeModeState {
    let restoreState = null;
    if (this._restoreState != null) {
      restoreState = Array.from(this._restoreState, provider => provider.name);
    }
    return {
      restoreState,
    };
  }

  consumeDistractionFreeModeProvider(
    provider: DistractionFreeModeProvider,
  ): IDisposable {
    this._providers.add(provider);
    if (
      this._deserializationState != null &&
      this._deserializationState.has(provider.name)
    ) {
      this._addToRestoreState(provider);
    }
    return new Disposable(() => {
      this._providers.delete(provider);
    });
  }

  toggleDistractionFreeMode(): void {
    // Once the user has interacted with distraction-free mode it would be weird if another package
    // loading triggered a change in the state.
    this._deserializationState = null;
    if (this._shouldRestore()) {
      this._exitDistractionFreeMode();
    } else {
      this._enterDistractionFreeMode();
    }
  }

  _addToRestoreState(provider: DistractionFreeModeProvider): void {
    let restoreState = this._restoreState;
    if (restoreState == null) {
      this._restoreState = restoreState = new Set();
    }
    restoreState.add(provider);
  }

  _shouldRestore(): boolean {
    if (this._restoreState == null) {
      return false;
    }
    for (const provider of this._providers) {
      if (provider.isVisible()) {
        // If the user has manually shown any provider they have probably forgotten they are in
        // distraction-free mode, and intend to enter it.
        return false;
      }
    }
    return true;
  }

  _enterDistractionFreeMode(): void {
    // This will be non-null if the user has entered distraction-free mode without toggling it off,
    // but has manually opened one or more of the providers. In that case, we want to re-enter
    // distraction-free mode, hiding the currently-visible providers, but when we exit we want to
    // restore both the previously-hidden providers and the currently-visible providers.
    let newRestoreState = this._restoreState;
    if (newRestoreState == null) {
      newRestoreState = new Set();
    }
    for (const provider of this._providers) {
      if (provider.isVisible()) {
        provider.toggle();
        newRestoreState.add(provider);
      }
    }
    this._restoreState = newRestoreState;
  }

  _exitDistractionFreeMode(): void {
    const restoreState = this._restoreState;
    invariant(restoreState != null);
    for (const provider of restoreState) {
      if (!provider.isVisible()) {
        provider.toggle();
      }
    }
    this._restoreState = null;
  }
}
