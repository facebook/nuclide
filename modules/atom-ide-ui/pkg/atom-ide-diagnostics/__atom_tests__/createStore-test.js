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
import {Range} from 'atom';
import {sleep} from 'nuclide-commons/promise';
import createStore from '../lib/redux/createStore';
import * as Actions from '../lib/redux/Actions';
import * as Selectors from '../lib/redux/Selectors';
import DiagnosticUpdater from '../lib/services/DiagnosticUpdater';
import MessageRangeTracker from '../lib/MessageRangeTracker';
import invariant from 'assert';

import type {Store} from '../lib/types';

// Test Constants
const dummyProviderA: any = {};
const dummyProviderB: any = {};

function makeEmptyMessages(filePath: string) {
  return {
    filePath,
    messages: [],
    totalMessages: 0,
  };
}

const fileMessageA = {
  providerName: 'dummyProviderA',
  type: 'Error',
  filePath: 'fileA',
};
const fileMessageA2 = {
  // Warning instead of Error
  providerName: 'dummyProviderA',
  type: 'Warning',
  filePath: 'fileA',
};
const fileMessageB = {
  providerName: 'dummyProviderB',
  type: 'Error',
  filePath: 'fileB',
};

describe('createStore', () => {
  let store: Store = (null: any);
  let updater: DiagnosticUpdater = (null: any);
  let spy_fileA: any;
  let spy_fileA_subscription;
  let spy_fileB: any;
  let spy_fileB_subscription;
  let spy_allMessages: any;
  let spy_allMessages_subscription;

  const disposeSpies = () => {
    if (spy_fileA_subscription) {
      spy_fileA_subscription.dispose();
    }
    if (spy_fileB_subscription) {
      spy_fileB_subscription.dispose();
    }
    if (spy_allMessages_subscription) {
      spy_allMessages_subscription.dispose();
    }
  };

  const setSpies = () => {
    spy_fileA = jest.fn();
    spy_fileB = jest.fn();
    spy_allMessages = jest.fn();

    spy_fileA_subscription = updater.observeFileMessages('fileA', spy_fileA);
    spy_fileB_subscription = updater.observeFileMessages('fileB', spy_fileB);
    spy_allMessages_subscription = updater.observeMessages(spy_allMessages);
  };

  const addUpdateA = () => {
    const updateA = new Map([['fileA', [fileMessageA]]]);
    store.dispatch(Actions.updateMessages(dummyProviderA, updateA));
  };

  const addUpdateB = () => {
    const updateB = new Map([['fileB', [fileMessageB]]]);
    store.dispatch(Actions.updateMessages(dummyProviderB, updateB));
  };

  const addUpdateA2 = () => {
    const updateA2 = new Map([['fileA', [fileMessageA2]]]);
    store.dispatch(Actions.updateMessages(dummyProviderA, updateA2));
  };

  beforeEach(() => {
    store = createStore(new MessageRangeTracker());
    updater = new DiagnosticUpdater(store);
  });

  afterEach(() => {
    disposeSpies();
  });

  it("removes the provider when it's unregistered", () => {
    addUpdateA();
    addUpdateB();
    let state = store.getState();
    expect(state.messages.size).toBe(2);

    store.dispatch(Actions.removeProvider(dummyProviderA));
    state = store.getState();
    expect(state.messages.size).toBe(1);
  });

  it('An updates only notifies listeners for the scope(s) of the update.', async () => {
    // Register spies. Spies should be called with the initial data.
    setSpies();
    expect(spy_fileA.mock.calls.length).toBe(1);
    expect(spy_fileB.mock.calls.length).toBe(1);
    expect(spy_allMessages.mock.calls.length).toBe(1);

    // Test 1. Add file messages from one provider.
    addUpdateA();

    await sleep(100);

    // Expect all spies except spy_fileB to have been called.
    expect(spy_fileB.mock.calls.length).toBe(1);

    expect(spy_fileA.mock.calls.length).toBe(2);
    expect(spy_fileA.mock.calls[spy_fileA.mock.calls.length - 1]).toEqual([
      {filePath: 'fileA', messages: [fileMessageA], totalMessages: 1},
    ]);
    await sleep(600); // wait for the observeMessages throttle cooldown
    expect(spy_allMessages.mock.calls.length).toBe(2);
    expect(
      spy_allMessages.mock.calls[spy_allMessages.mock.calls.length - 1][0],
    ).toEqual([fileMessageA]);

    // Expect the getter methods on DiagnosticStore to return correct info.
    expect(Selectors.getFileMessages(store.getState())('fileA')).toEqual({
      filePath: 'fileA',
      messages: [fileMessageA],
      totalMessages: 1,
    });
    const allMessages = Selectors.getAllMessages(store.getState());
    expect(allMessages).toEqual([fileMessageA]);
  });

  it(
    'An update should notify listeners for the scope(s) of the update, and not affect other' +
      ' listeners.',
    async () => {
      // Set the initial state of the store.
      addUpdateA();

      // Register spies. Some spies should be called immediately because there is
      // data in the store.
      setSpies();
      expect(spy_fileA.mock.calls.length).toBe(1);
      expect(spy_fileA).toHaveBeenCalledWith({
        filePath: 'fileA',
        messages: [fileMessageA],
        totalMessages: 1,
      });
      expect(spy_fileB.mock.calls.length).toBe(1);
      expect(spy_fileB).toHaveBeenCalledWith(makeEmptyMessages('fileB'));
      await sleep(600); // wait for the observeMessages throttle cooldown
      expect(spy_allMessages.mock.calls.length).toBe(1);
      expect(
        spy_allMessages.mock.calls[spy_allMessages.mock.calls.length - 1][0],
      ).toEqual([fileMessageA]);

      // Test 2. Add file messages from a second provider.
      // They should not interfere with messages from the first provider.
      addUpdateB();

      await sleep(100);

      // spy_fileA experiences no change.
      expect(spy_fileA.mock.calls.length).toBe(1);

      // spy_fileB is called from updateB.
      expect(spy_fileB.mock.calls.length).toBe(2);
      expect(spy_fileB.mock.calls[spy_fileB.mock.calls.length - 1]).toEqual([
        {filePath: 'fileB', messages: [fileMessageB], totalMessages: 1},
      ]);

      // spy_allMessages is called from data from the initial state and from updateB.
      expect(spy_allMessages.mock.calls.length).toBe(2);
      expect(
        spy_allMessages.mock.calls[spy_allMessages.mock.calls.length - 1][0],
      ).toEqual([fileMessageA, fileMessageB]);

      // Expect the getter methods on DiagnosticStore to return correct data.
      expect(Selectors.getFileMessages(store.getState())('fileA')).toEqual({
        filePath: 'fileA',
        messages: [fileMessageA],
        totalMessages: 1,
      });
      expect(Selectors.getFileMessages(store.getState())('fileB')).toEqual({
        filePath: 'fileB',
        messages: [fileMessageB],
        totalMessages: 1,
      });
      const allMessages = Selectors.getAllMessages(store.getState());
      expect(allMessages).toEqual([fileMessageA, fileMessageB]);
    },
  );

  it(
    'An update from the same provider should overwrite previous messages from that' +
      ' provider.',
    async () => {
      // Set the initial state of the store.
      addUpdateA();
      addUpdateB();

      // Register spies. All spies should be called immediately because there is
      // relevant data in the store.
      setSpies();

      // 3. Add new messages from ProviderA. They should overwrite existing
      // messages from ProviderA at the same scope.
      // ProviderB messages should remain the same.
      addUpdateA2();

      await sleep(100);

      // spy_fileB is called with data from the initial state.
      expect(spy_fileB.mock.calls.length).toBe(1);

      // spy_fileA and spy_allMessages are called with data from the
      // initial state and updateA2.
      expect(spy_fileA.mock.calls.length).toBe(2);
      expect(spy_fileA.mock.calls[spy_fileA.mock.calls.length - 1]).toEqual([
        {filePath: 'fileA', messages: [fileMessageA2], totalMessages: 1},
      ]);
      await sleep(600); // wait for the observeMessages throttle cooldown
      expect(spy_allMessages.mock.calls.length).toBe(2);
      expect(
        spy_allMessages.mock.calls[spy_allMessages.mock.calls.length - 1][0],
      ).toEqual([fileMessageA2, fileMessageB]);

      // Expect the getter methods on DiagnosticStore to return the correct info.
      expect(Selectors.getFileMessages(store.getState())('fileA')).toEqual({
        filePath: 'fileA',
        messages: [fileMessageA2],
        totalMessages: 1,
      });
      expect(Selectors.getFileMessages(store.getState())('fileB')).toEqual({
        filePath: 'fileB',
        messages: [fileMessageB],
        totalMessages: 1,
      });
      const allMessages = Selectors.getAllMessages(store.getState());
      expect(allMessages).toEqual([fileMessageA2, fileMessageB]);
    },
  );

  describe('When an invalidation message is sent from one provider, ', () => {
    it(
      'if specifying file scope, it should only invalidate messages from that provider for that' +
        ' file.',
      async () => {
        // Set up the state of the store.
        addUpdateB();
        addUpdateA2();

        // Register spies. All spies should be called immediately because there is
        // relevant data in the store.
        setSpies();

        // Test 4A. Invalidate file messages from ProviderA.
        const fileInvalidationMessage = {scope: 'file', filePaths: ['fileA']};
        store.dispatch(
          Actions.invalidateMessages(dummyProviderA, fileInvalidationMessage),
        );

        await sleep(100);

        // Expect spy_fileA and spy_allMessages to have been called from the
        // invalidation message.
        // File messages from ProviderA should be gone, but no other changes.
        // At this point, there should only be ProviderB file messages.
        expect(spy_fileB.mock.calls.length).toBe(1);

        expect(spy_fileA.mock.calls.length).toBe(2);
        expect(spy_fileA.mock.calls[spy_fileA.mock.calls.length - 1]).toEqual([
          makeEmptyMessages('fileA'),
        ]);
        await sleep(600); // wait for the observeMessages throttle cooldown
        expect(spy_allMessages.mock.calls.length).toBe(2);
        expect(
          spy_allMessages.mock.calls[spy_allMessages.mock.calls.length - 1][0],
        ).toEqual([fileMessageB]);

        // Expect the getter methods on DiagnosticStore to return the correct info.
        expect(Selectors.getFileMessages(store.getState())('fileA')).toEqual(
          makeEmptyMessages('fileA'),
        );
        expect(Selectors.getFileMessages(store.getState())('fileB')).toEqual({
          filePath: 'fileB',
          messages: [fileMessageB],
          totalMessages: 1,
        });
        const allMessages = Selectors.getAllMessages(store.getState());
        expect(allMessages).toEqual([fileMessageB]);
      },
    );
  });

  it('When callbacks are unregistered, they are not messaged with updates.', () => {
    // Set up the state of the store.
    addUpdateB();

    // Register spies. Spies should be called immediately because there is relevant data in the
    // store.
    setSpies();
    expect(spy_fileA.mock.calls.length).toBe(1);
    expect(spy_fileB.mock.calls.length).toBe(1);
    expect(spy_allMessages.mock.calls.length).toBe(1);

    // Test 5. Remove listeners, then invalidate all messages from ProviderB.
    // We don't need to remove spy_fileA_subscription -- it shouldn't be called anyway.
    invariant(spy_fileB_subscription);
    spy_fileB_subscription.dispose();
    invariant(spy_allMessages_subscription);
    spy_allMessages_subscription.dispose();

    // All messages from ProviderB should be removed.
    const providerInvalidationMessage = {scope: 'all'};
    store.dispatch(
      Actions.invalidateMessages(dummyProviderB, providerInvalidationMessage),
    );

    // There should have been no additional calls on the spies.
    expect(spy_fileA.mock.calls.length).toBe(1);
    expect(spy_fileB.mock.calls.length).toBe(1);
    expect(spy_allMessages.mock.calls.length).toBe(1);

    // Expect the getter methods on DiagnosticStore to return the correct info.
    expect(Selectors.getFileMessages(store.getState())('fileA')).toEqual(
      makeEmptyMessages('fileA'),
    );
    expect(Selectors.getFileMessages(store.getState())('fileB')).toEqual(
      makeEmptyMessages('fileB'),
    );
    expect(Selectors.getAllMessages(store.getState()).length).toBe(0);
  });

  describe('autofix', () => {
    const messageWithAutofix = {
      providerName: 'dummyProviderA',
      type: 'Error',
      filePath: '/tmp/fileA',
      fix: {
        oldRange: new Range([0, 0], [0, 1]),
        newText: 'FOO',
      },
    };

    let editor: atom$TextEditor = (null: any);

    beforeEach(async () => {
      editor = await atom.workspace.open('/tmp/fileA');
      editor.setText('foobar\n');
      store.dispatch(
        Actions.updateMessages(
          dummyProviderA,
          new Map([['/tmp/fileA', [messageWithAutofix]]]),
        ),
      );
    });

    describe('applyFix', () => {
      it('should apply the fix to the editor', () => {
        store.dispatch(Actions.applyFix(messageWithAutofix));
        expect(editor.getText()).toEqual('FOOoobar\n');
      });

      it('should invalidate the message', () => {
        expect(
          Selectors.getFileMessages(store.getState())('/tmp/fileA').messages,
        ).toEqual([messageWithAutofix]);
        store.dispatch(Actions.applyFix(messageWithAutofix));
        expect(
          Selectors.getFileMessages(store.getState())('/tmp/fileA').messages,
        ).toEqual([]);
      });
    });

    describe('applyFixesForFile', () => {
      it('should apply the fixes for the given file', () => {
        store.dispatch(Actions.applyFixesForFile('/tmp/fileA'));
        expect(editor.getText()).toEqual('FOOoobar\n');
      });
    });
  });
});
