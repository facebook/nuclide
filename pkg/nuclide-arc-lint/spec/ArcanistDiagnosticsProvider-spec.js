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

// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {__testing__} from '../lib/ArcanistDiagnosticsProvider';
import {Range} from 'atom';
import invariant from 'assert';
import {Observable} from 'rxjs';

const {
  _findDiagnostics,
  _getFix,
  _getRangeForFix,
  _runningProcess,
} = __testing__;

describe('ArcanistDiagnosticsProvider', () => {
  describe('_getRangeForFix', () => {
    it('should work for single-line fixes', () => {
      const range = _getRangeForFix(3, 4, 'asdf');
      expect(range).toEqual(new Range([3, 4], [3, 8]));
    });

    it('should work for multi-line fixes', () => {
      const range = _getRangeForFix(3, 4, '\nasdf\njdjdj\n');
      expect(range).toEqual(new Range([3, 4], [6, 0]));
    });
  });

  describe('_getFix', () => {
    it('should return the fix', () => {
      const fix = _getFix({
        row: 1,
        col: 3,
        original: 'foo',
        replacement: 'bar',
      });
      expect(fix).toEqual({
        range: new Range([1, 3], [1, 6]),
        oldText: 'foo',
        newText: 'bar',
      });
    });

    it('should truncate a common suffix', () => {
      const fix = _getFix({
        row: 1,
        col: 3,
        original: 'foobar',
        replacement: 'fbar',
      });
      expect(fix).toEqual({
        range: new Range([1, 3], [1, 6]),
        oldText: 'foo',
        newText: 'f',
      });
    });
  });

  describe('_findDiagnostics', () => {
    it('cancels prior invocations', () => {
      waitsForPromise(async () => {
        let mockObserver;
        const disposeSpy = jasmine.createSpy('dispose');
        spyOn(
          require('../../nuclide-remote-connection'),
          'getArcanistServiceByNuclideUri',
        ).andReturn({
          findDiagnostics: () => {
            return Observable.create(observer => {
              mockObserver = observer;
              return disposeSpy;
            }).publish();
          },
        });

        const run1 = _findDiagnostics('test');
        const run2 = _findDiagnostics('test');
        // The first run should be cancelled as soon as the second run is triggered.
        expect(await run1).toBeUndefined();
        expect(disposeSpy).toHaveBeenCalled();

        // Make sure the second run follows through with results.
        invariant(mockObserver);
        mockObserver.next({a: 'test'});
        mockObserver.complete();
        expect(await run2).toEqual([{a: 'test'}]);
        expect(disposeSpy.callCount).toBe(2);

        jasmine.Clock.useMock();
        const rejectSpy = jasmine.createSpy('reject');
        const run3 = _findDiagnostics('test').catch(rejectSpy);
        jasmine.Clock.tick(100000);
        await run3;
        expect(rejectSpy).toHaveBeenCalled();

        // Ensure that the subject cache cleans itself up.
        expect(_runningProcess.size).toBe(0);
      });
    });
  });
});
