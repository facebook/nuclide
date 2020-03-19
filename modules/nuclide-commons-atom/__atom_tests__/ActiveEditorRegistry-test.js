/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import type {
  EventSources,
  ResultFunction,
  Result,
} from '../ActiveEditorRegistry';

import type {Observable} from 'rxjs';

import {expectObservableToStartWith} from 'nuclide-commons/test-helpers';
import {Subject} from 'rxjs';

import ActiveEditorRegistry from '../ActiveEditorRegistry';

type TestProvider = {
  priority: number,
  grammarScopes: Array<string>,
};

describe('ActiveEditorRegistry', () => {
  let activeEditorRegistry: ActiveEditorRegistry<
    TestProvider,
    void,
  > = (null: any);

  let activeEditors: Subject<?atom$TextEditor> = (null: any);
  let editorSaves: Subject<void> = (null: any);

  let resultFunction: ResultFunction<TestProvider, void> = (null: any);
  let eventSources: EventSources = (null: any);

  let editor1: atom$TextEditor = (null: any);
  let editor2: atom$TextEditor = (null: any);

  let events: Observable<Result<TestProvider, void>> = (null: any);
  let eventNames: Observable<string> = (null: any);

  let shouldProviderError: boolean = (null: any);

  function initializeService() {
    activeEditorRegistry = new ActiveEditorRegistry(
      resultFunction,
      eventSources,
    );

    events = activeEditorRegistry.getResultsStream().publishReplay();
    eventNames = events.map(event => event.kind);
    events.connect();
  }

  beforeEach(async () => {
    activeEditors = new Subject();
    editorSaves = new Subject();
    shouldProviderError = false;

    resultFunction = jest.fn().mockImplementation(async () => {
      if (shouldProviderError) {
        throw new Error('baaaaad');
      }
    });
    eventSources = {
      activeEditors,
      savesForEditor: () => editorSaves,
    };

    initializeService();

    editor1 = await atom.workspace.open();
    editor2 = await atom.workspace.open();
  });

  describe('when there is a provider', () => {
    let provider: TestProvider = (null: any);
    beforeEach(() => {
      provider = {
        priority: 10,
        grammarScopes: ['text.plain.null-grammar'],
      };
      activeEditorRegistry.consumeProvider(provider);
    });

    it('should create correct event stream during normal use', async () => {
      activeEditors.next(null);
      await waitForNextTick();

      activeEditors.next(editor1);
      await waitForNextTick();

      activeEditors.next(editor2);

      await expectObservableToStartWith(eventNames, [
        'not-text-editor',
        'pane-change',
        'result',
        'pane-change',
        'result',
      ]);

      const fullEvents = await events
        .take(3)
        .toArray()
        .toPromise();
      expect(fullEvents[1]).toEqual({
        kind: 'pane-change',
        editor: editor1,
      });
      expect(fullEvents[2]).toEqual({
        kind: 'result',
        editor: editor1,
        provider,
        result: undefined,
      });
    });

    describe('when configured to respond to save events', () => {
      beforeEach(() => {
        initializeService();
        // Have to re-add this since the re-initialization kills it
        activeEditorRegistry.consumeProvider({
          priority: 10,
          grammarScopes: ['text.plain.null-grammar'],
        });
      });

      it('should generate and respond to save events', async () => {
        activeEditors.next(editor1);
        await waitForNextTick();

        editorSaves.next(undefined);
        await waitForNextTick();

        await expectObservableToStartWith(eventNames, [
          'pane-change',
          'result',
          'save',
          'result',
        ]);

        const fullEvents = await events
          .take(3)
          .toArray()
          .toPromise();
        expect(fullEvents[2]).toEqual({
          kind: 'save',
          editor: editor1,
        });
      });
    });

    it("should produce the 'provider-error' event when a provider errors", async () => {
      shouldProviderError = true;

      activeEditors.next(editor1);
      await waitForNextTick();

      await expectObservableToStartWith(eventNames, [
        'pane-change',
        'provider-error',
      ]);

      expect(await events.elementAt(1).toPromise()).toEqual({
        kind: 'provider-error',
        provider,
      });
    });

    it('should immediately query a better provider', () => {
      const betterProvider = {
        priority: 20,
        grammarScopes: ['text.plain.null-grammar'],
      };

      activeEditors.next(editor1);
      expect(resultFunction).toHaveBeenCalledWith(provider, editor1);
      activeEditorRegistry.consumeProvider(betterProvider);
      expect(resultFunction).toHaveBeenCalledWith(betterProvider, editor1);
    });
  });

  describe('when there is no provider', () => {
    it("should produce the 'no-provider' result when there is no provider", async () => {
      activeEditors.next(editor1);
      await waitForNextTick();

      await expectObservableToStartWith(eventNames, [
        'pane-change',
        'no-provider',
      ]);
    });
  });
});

function waitForNextTick(): Promise<void> {
  return new Promise(resolve => process.nextTick(resolve));
}
