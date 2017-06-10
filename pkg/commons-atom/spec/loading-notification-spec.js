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
import loadingNotification from '../loading-notification';

describe('loadingNotification', () => {
  let mockNotif;
  beforeEach(() => {
    mockNotif = {
      dismiss: jasmine.createSpy('dismiss'),
    };
    spyOn(atom.notifications, 'addInfo').andReturn(mockNotif);
  });

  it('displays and closes a loading notification', () => {
    waitsForPromise(async () => {
      const testValue = 1;
      const promise = new Promise((resolve, reject) => {
        setTimeout(() => resolve(testValue), 10);
      });
      const resultPromise = loadingNotification(
        promise,
        'test message',
        /* delayMs */ 0,
      );
      advanceClock(10);
      expect(await resultPromise).toEqual(testValue);
      expect(atom.notifications.addInfo).toHaveBeenCalled();
      invariant(mockNotif);
      expect(mockNotif.dismiss).toHaveBeenCalled();
    });
  });

  it('displays and closes a loading notification for errors', () => {
    waitsForPromise(async () => {
      const promise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error()), 10);
      });
      try {
        const resultPromise = loadingNotification(
          promise,
          'test message',
          /* delayMs */ 0,
        );
        advanceClock(10);
        await resultPromise;
      } catch (e) {}
      expect(atom.notifications.addInfo).toHaveBeenCalled();
      invariant(mockNotif);
      expect(mockNotif.dismiss).toHaveBeenCalled();
    });
  });

  it('does nothing for fast promises', () => {
    waitsForPromise(async () => {
      const testValue = 1;
      const promise = new Promise((resolve, reject) => {
        setTimeout(() => resolve(testValue), 1);
      });
      const resultPromise = loadingNotification(
        promise,
        'test message',
        /* delayMs */ 10,
      );
      advanceClock(1);
      expect(await resultPromise).toEqual(testValue);
      expect(atom.notifications.addInfo.calls.length).toEqual(0);
      invariant(mockNotif);
      expect(mockNotif.dismiss.calls.length).toEqual(0);
    });
  });
});
