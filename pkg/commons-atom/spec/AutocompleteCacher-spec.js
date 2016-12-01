'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Point} from 'atom';

import {Deferred} from '../../commons-node/promise';

import AutocompleteCacher from '../AutocompleteCacher';

describe('AutocompleteCacher', () => {
  let getSuggestions: JasmineSpy = (null: any);
  let updateResults: JasmineSpy = (null: any);
  let mockedSuggestions: Promise<Array<string>> = (null: any);
  let mockedUpdateResults: Array<string> = (null: any);
  // returned from the second call
  let secondMockedUpdateResults: Array<string> = (null: any);

  let autocompleteCacher: AutocompleteCacher<Array<string>> = (null: any);

  let mockedRequest: atom$AutocompleteRequest = (null: any);
  let mockedRequest2: atom$AutocompleteRequest = (null: any);
  let mockedRequest3: atom$AutocompleteRequest = (null: any);

  // Denotes a new autocomplete session. Previous results cannot be re-used.
  let separateMockedRequest: atom$AutocompleteRequest = (null: any);

  beforeEach(() => {
    waitsForPromise(async () => {
      mockedSuggestions = Promise.resolve([]);
      mockedUpdateResults = ['first'];
      secondMockedUpdateResults = ['second'];

      mockedRequest = {
        editor: await atom.workspace.open(),
        bufferPosition: new Point(0, 0),
        scopeDescriptor: 'foo',
        prefix: '',
        activatedManually: false,
      };

      mockedRequest2 = {
        ...mockedRequest,
        bufferPosition: new Point(0, 1),
        prefix: 'b',
      };

      mockedRequest3 = {
        ...mockedRequest,
        bufferPosition: new Point(0, 2),
        prefix: 'ba',
      };

      separateMockedRequest = {
        ...mockedRequest,
        bufferPosition: new Point(1, 0),
        prefix: '',
      };

      getSuggestions = jasmine.createSpy('getSuggestions').andCallFake(() => {
        return mockedSuggestions;
      });
      let updateResultsCallCount = 0;
      updateResults = jasmine.createSpy('updateResults').andCallFake(() => {
        let result;
        if (updateResultsCallCount > 0) {
          result = secondMockedUpdateResults;
        } else {
          result = mockedUpdateResults;
        }
        updateResultsCallCount++;
        return result;
      });
      autocompleteCacher = new AutocompleteCacher({
        getSuggestions: request => getSuggestions(request),
        updateResults: (request, previousResults) => updateResults(request, previousResults),
      });
    });
  });

  it('should call through on first request', () => {
    waitsForPromise(async () => {
      const results = await autocompleteCacher.getSuggestions(mockedRequest);
      expect(results).toBe(await mockedSuggestions);
      expect(getSuggestions).toHaveBeenCalledWith(mockedRequest);
      expect(updateResults).not.toHaveBeenCalled();
    });
  });

  it('should just filter original results on the second request', () => {
    waitsForPromise(async () => {
      await autocompleteCacher.getSuggestions(mockedRequest);
      const secondResults = await autocompleteCacher.getSuggestions(mockedRequest2);

      expect(getSuggestions.callCount).toBe(1);
      expect(getSuggestions).toHaveBeenCalledWith(mockedRequest);

      expect(updateResults.callCount).toBe(1);
      expect(updateResults).toHaveBeenCalledWith(mockedRequest2, await mockedSuggestions);

      expect(secondResults).toBe(mockedUpdateResults);
    });
  });

  it('should satisfy a second query even if the original has not yet resolved', () => {
    waitsForPromise(async () => {
      const originalSuggestionDeferred = new Deferred();
      mockedSuggestions = originalSuggestionDeferred.promise;

      // on purpose don't await here. the promise is not resolved until later
      const firstResultPromise = autocompleteCacher.getSuggestions(mockedRequest);

      const secondResultPromise = autocompleteCacher.getSuggestions(mockedRequest2);

      expect(getSuggestions.callCount).toBe(1);
      expect(getSuggestions).toHaveBeenCalledWith(mockedRequest);
      expect(updateResults).not.toHaveBeenCalled();

      originalSuggestionDeferred.resolve([]);
      expect(await firstResultPromise).toBe(await originalSuggestionDeferred.promise);

      expect(updateResults.callCount).toBe(1);
      expect(updateResults).toHaveBeenCalledWith(mockedRequest2, await firstResultPromise);

      expect(await secondResultPromise).toBe(mockedUpdateResults);
      expect(getSuggestions.callCount).toBe(1);
    });
  });

  it('should satisfy a third query even if the original has not yet resolved', () => {
    waitsForPromise(async () => {
      const originalSuggestionDeferred = new Deferred();
      mockedSuggestions = originalSuggestionDeferred.promise;

      // on purpose don't await here. the promise is not resolved until later
      autocompleteCacher.getSuggestions(mockedRequest);
      const secondResult = autocompleteCacher.getSuggestions(mockedRequest2);
      const finalResult = autocompleteCacher.getSuggestions(mockedRequest3);

      expect(getSuggestions.callCount).toBe(1);
      expect(getSuggestions).toHaveBeenCalledWith(mockedRequest);
      expect(updateResults).not.toHaveBeenCalled();

      originalSuggestionDeferred.resolve([]);

      expect(await secondResult).toBe(mockedUpdateResults);
      expect(await finalResult).toBe(secondMockedUpdateResults);

      expect(updateResults.callCount).toBe(2);
      expect(updateResults.calls.map(call => call.args)).toEqual([
        [mockedRequest2, await mockedSuggestions],
        [mockedRequest3, await mockedSuggestions],
      ]);

      expect(getSuggestions.callCount).toBe(1);
    });
  });

  it('should pass a new request through if it cannot filter', () => {
    waitsForPromise(async () => {
      await autocompleteCacher.getSuggestions(mockedRequest);
      const secondResults = await autocompleteCacher.getSuggestions(separateMockedRequest);

      expect(getSuggestions.callCount).toBe(2);
      expect(getSuggestions.calls.map(call => call.args)).toEqual([
        [mockedRequest],
        [separateMockedRequest],
      ]);

      expect(updateResults).not.toHaveBeenCalled();

      expect(secondResults).toBe(await mockedSuggestions);
    });
  });
});
