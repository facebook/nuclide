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

import {DistractionFreeMode} from '../lib/DistractionFreeMode';

describe('DistractionFreeMode', () => {
  let distractionFreeMode: DistractionFreeMode = (null: any);
  let provider1: FakeProvider = (null: any);
  let provider2: FakeProvider = (null: any);

  beforeEach(() => {
    distractionFreeMode = new DistractionFreeMode(undefined);
    provider1 = new FakeProvider('provider1');
    provider2 = new FakeProvider('provider2');
  });

  describe('during a Nuclide session', () => {
    beforeEach(() => {
      distractionFreeMode.consumeDistractionFreeModeProvider(provider1);
      distractionFreeMode.consumeDistractionFreeModeProvider(provider2);
    });

    it('should hide the providers', () => {
      distractionFreeMode.toggleDistractionFreeMode();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();
    });

    it('should show the providers again', () => {
      distractionFreeMode.toggleDistractionFreeMode();
      distractionFreeMode.toggleDistractionFreeMode();
      expect(provider1.isVisible()).toBeTruthy();
      expect(provider2.isVisible()).toBeTruthy();
    });

    it('should only restore the providers that were visible', () => {
      provider1.toggle();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeTruthy();

      distractionFreeMode.toggleDistractionFreeMode();

      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();

      distractionFreeMode.toggleDistractionFreeMode();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeTruthy();
    });

    it('should re-enter distraction-free mode if a provider is manually opened', () => {
      provider1.toggle();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeTruthy();

      // Enter distraction-free mode
      distractionFreeMode.toggleDistractionFreeMode();

      // User manually opens something
      provider1.toggle();

      // Since something is open, the intent is probably to get back into the distraction-free mode.
      // So, the provider should be hidden.
      distractionFreeMode.toggleDistractionFreeMode();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();

      // Now they are leaving distraction-free mode. We should restore all the providers that we
      // have previously hidden. So we shoudl restore provider2 (hidden on first entry) and
      // provider1 (hidden on second entry)
      distractionFreeMode.toggleDistractionFreeMode();
      expect(provider1.isVisible()).toBeTruthy();
      expect(provider2.isVisible()).toBeTruthy();
    });

    it('should serialize properly when not in distraction-free-mode mode', () => {
      expect(distractionFreeMode.serialize()).toEqual({
        restoreState: null,
      });
    });

    it('should serialize properly when in distraction-free-mode mode', () => {
      provider1.toggle();
      distractionFreeMode.toggleDistractionFreeMode();
      expect(distractionFreeMode.serialize()).toEqual({
        restoreState: ['provider2'],
      });
    });
  });

  describe('deserialization', () => {
    it('should properly deserialize from a non-distraction-free-mode state', () => {
      distractionFreeMode = new DistractionFreeMode({restoreState: null});
      distractionFreeMode.consumeDistractionFreeModeProvider(provider1);
      distractionFreeMode.consumeDistractionFreeModeProvider(provider2);

      distractionFreeMode.toggleDistractionFreeMode();

      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();
    });

    it('should properly deserialize from a distraction-free-mode state', () => {
      // Simulate the providers serializing their own state -- they would start out hidden if we
      // exited Nuclide in distraction-free-mode.
      provider1.toggle();
      provider2.toggle();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();

      distractionFreeMode = new DistractionFreeMode({
        restoreState: ['provider1', 'provider2'],
      });
      distractionFreeMode.consumeDistractionFreeModeProvider(provider1);
      distractionFreeMode.consumeDistractionFreeModeProvider(provider2);

      distractionFreeMode.toggleDistractionFreeMode();
      expect(provider1.isVisible()).toBeTruthy();
      expect(provider2.isVisible()).toBeTruthy();
    });

    it('should discard serialized state once it receives a toggle command', () => {
      provider1.toggle();
      provider2.toggle();
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();

      distractionFreeMode = new DistractionFreeMode({
        restoreState: ['provider1', 'provider2'],
      });
      distractionFreeMode.consumeDistractionFreeModeProvider(provider1);

      distractionFreeMode.toggleDistractionFreeMode();

      expect(provider1.isVisible()).toBeTruthy();
      expect(provider2.isVisible()).toBeFalsy();

      // Now it would be weird if this somehow bumped us back into distraction-free mode. This
      // shouldn't happen very often, though, since usually all providers will get registered at
      // startup.
      distractionFreeMode.consumeDistractionFreeModeProvider(provider2);

      expect(provider1.isVisible()).toBeTruthy();
      expect(provider2.isVisible()).toBeFalsy();

      distractionFreeMode.toggleDistractionFreeMode();

      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();
    });

    it("should behave sanely if a provider doesn't serialize its toggled state", () => {
      provider1.toggle();
      // Don't toggle provider2 -- so it starts open.
      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeTruthy();

      // Exited in distraction-free mode -- it had hidden both providers
      distractionFreeMode = new DistractionFreeMode({
        restoreState: ['provider1', 'provider2'],
      });
      distractionFreeMode.consumeDistractionFreeModeProvider(provider1);
      distractionFreeMode.consumeDistractionFreeModeProvider(provider2);

      distractionFreeMode.toggleDistractionFreeMode();

      // It should hide provider2 and enter a distraction-free mode where it will restore both

      expect(provider1.isVisible()).toBeFalsy();
      expect(provider2.isVisible()).toBeFalsy();

      distractionFreeMode.toggleDistractionFreeMode();

      expect(provider1.isVisible()).toBeTruthy();
      expect(provider2.isVisible()).toBeTruthy();
    });
  });
});

class FakeProvider {
  _isVisible: boolean;
  name: string;

  constructor(name: string) {
    this._isVisible = true;
    this.name = name;
  }

  isVisible(): boolean {
    return this._isVisible;
  }

  toggle(): void {
    this._isVisible = !this._isVisible;
  }
}
