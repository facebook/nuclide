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
 */

import {Range} from 'atom';
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

const fileMessageA = {
  scope: 'file',
  providerName: 'dummyProviderA',
  type: 'Error',
  filePath: 'fileA',
};
const fileMessageA2 = {
  // Warning instead of Error
  scope: 'file',
  providerName: 'dummyProviderA',
  type: 'Warning',
  filePath: 'fileA',
};
const fileMessageB = {
  scope: 'file',
  providerName: 'dummyProviderB',
  type: 'Error',
  filePath: 'fileB',
};

const projectMessageA = {
  scope: 'project',
  providerName: 'dummyProviderA',
  type: 'Error',
};
const projectMessageA2 = {
  // Warning instead of Error
  scope: 'project',
  providerName: 'dummyProviderA',
  type: 'Warning',
};
const projectMessageB = {
  scope: 'project',
  providerName: 'dummyProviderB',
  type: 'Error',
};

describe('createStore', () => {
  let store: Store = (null: any);
  let updater: DiagnosticUpdater = (null: any);
  let spy_fileA: any;
  let spy_fileA_subscription;
  let spy_fileB: any;
  let spy_fileB_subscription;
  let spy_project: any;
  let spy_project_subscription;
  let spy_allMessages: any;
  let spy_allMessages_subscription;

  const disposeSpies = () => {
    if (spy_fileA_subscription) {
      spy_fileA_subscription.dispose();
    }
    if (spy_fileB_subscription) {
      spy_fileB_subscription.dispose();
    }
    if (spy_project_subscription) {
      spy_project_subscription.dispose();
    }
    if (spy_allMessages_subscription) {
      spy_allMessages_subscription.dispose();
    }
  };

  const setSpies = () => {
    spy_fileA = jasmine.createSpy();
    spy_fileB = jasmine.createSpy();
    spy_project = jasmine.createSpy();
    spy_allMessages = jasmine.createSpy();

    spy_fileA_subscription = updater.onFileMessagesDidUpdate(
      spy_fileA,
      'fileA',
    );
    spy_fileB_subscription = updater.onFileMessagesDidUpdate(
      spy_fileB,
      'fileB',
    );
    spy_project_subscription = updater.onProjectMessagesDidUpdate(spy_project);
    spy_allMessages_subscription = updater.onAllMessagesDidUpdate(
      spy_allMessages,
    );
  };

  const addUpdateA = () => {
    const updateA = {
      filePathToMessages: new Map([['fileA', [fileMessageA]]]),
      projectMessages: [projectMessageA],
    };
    store.dispatch(Actions.updateMessages(dummyProviderA, updateA));
  };

  const addUpdateB = () => {
    const updateB = {
      filePathToMessages: new Map([['fileB', [fileMessageB]]]),
      projectMessages: [projectMessageB],
    };
    store.dispatch(Actions.updateMessages(dummyProviderB, updateB));
  };

  const addUpdateA2 = () => {
    const updateA2 = {
      filePathToMessages: new Map([['fileA', [fileMessageA2]]]),
      projectMessages: [projectMessageA2],
    };
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
    expect(state.projectMessages.size).toBe(2);

    store.dispatch(Actions.removeProvider(dummyProviderA));
    state = store.getState();
    expect(state.messages.size).toBe(1);
    expect(state.projectMessages.size).toBe(1);
  });

  it('An updates only notifies listeners for the scope(s) of the update.', () => {
    // Register spies. Spies should be called with the initial data.
    setSpies();
    expect(spy_fileA.callCount).toBe(1);
    expect(spy_fileB.callCount).toBe(1);
    expect(spy_project.callCount).toBe(1);
    expect(spy_allMessages.callCount).toBe(1);

    // Test 1. Add file and project messages from one provider.
    addUpdateA();

    // Expect all spies except spy_fileB to have been called.
    expect(spy_fileB.callCount).toBe(1);

    expect(spy_fileA.calls.length).toBe(2);
    expect(spy_fileA.mostRecentCall.args).toEqual([
      {filePath: 'fileA', messages: [fileMessageA]},
    ]);
    expect(spy_project.callCount).toBe(2);
    expect(spy_project.mostRecentCall.args).toEqual([[projectMessageA]]);
    expect(spy_allMessages.calls.length).toBe(2);
    expect(spy_allMessages.mostRecentCall.args[0].length).toBe(2);
    expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageA);
    expect(spy_allMessages.mostRecentCall.args[0]).toContain(projectMessageA);

    // Expect the getter methods on DiagnosticStore to return correct info.
    expect(Selectors.getFileMessages(store.getState(), 'fileA')).toEqual([
      fileMessageA,
    ]);
    expect(Selectors.getProjectMessages(store.getState())).toEqual([
      projectMessageA,
    ]);
    const allMessages = Selectors.getAllMessages(store.getState());
    expect(allMessages.length).toBe(2);
    expect(allMessages).toContain(fileMessageA);
    expect(allMessages).toContain(projectMessageA);
  });

  it(
    'An update should notify listeners for the scope(s) of the update, and not affect other' +
      ' listeners.',
    () => {
      // Set the initial state of the store.
      addUpdateA();

      // Register spies. Some spies should be called immediately because there is
      // data in the store.
      setSpies();
      expect(spy_fileA.callCount).toBe(1);
      expect(spy_fileA).toHaveBeenCalledWith({
        filePath: 'fileA',
        messages: [fileMessageA],
      });
      expect(spy_fileB.callCount).toBe(1);
      expect(spy_fileB).toHaveBeenCalledWith({filePath: 'fileB', messages: []});
      expect(spy_project.calls.length).toBe(1);
      expect(spy_project.mostRecentCall.args[0].length).toBe(1);
      expect(spy_project.mostRecentCall.args[0]).toContain(projectMessageA);
      expect(spy_allMessages.calls.length).toBe(1);
      expect(spy_allMessages.mostRecentCall.args[0].length).toBe(2);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageA);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(projectMessageA);

      // Test 2. Add file and project messages from a second provider.
      // They should not interfere with messages from the first provider.
      addUpdateB();

      // spy_fileA experiences no change.
      expect(spy_fileA.calls.length).toBe(1);

      // spy_fileB is called from updateB.
      expect(spy_fileB.callCount).toBe(2);
      expect(spy_fileB.mostRecentCall.args).toEqual([
        {filePath: 'fileB', messages: [fileMessageB]},
      ]);

      // spy_project and spy_allMessages are called from data from the initial state
      // and from updateB.
      expect(spy_project.calls.length).toBe(2);
      expect(spy_project.mostRecentCall.args[0].length).toBe(2);
      expect(spy_project.mostRecentCall.args[0]).toContain(projectMessageA);
      expect(spy_project.mostRecentCall.args[0]).toContain(projectMessageB);
      expect(spy_allMessages.calls.length).toBe(2);
      expect(spy_allMessages.mostRecentCall.args[0].length).toBe(4);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageA);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(projectMessageA);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageB);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(projectMessageB);

      // Expect the getter methods on DiagnosticStore to return correct data.
      expect(Selectors.getFileMessages(store.getState(), 'fileA')).toEqual([
        fileMessageA,
      ]);
      expect(Selectors.getFileMessages(store.getState(), 'fileB')).toEqual([
        fileMessageB,
      ]);
      const projectMessages = Selectors.getProjectMessages(store.getState());
      expect(projectMessages.length).toBe(2);
      expect(projectMessages).toContain(projectMessageA);
      expect(projectMessages).toContain(projectMessageB);
      const allMessages = Selectors.getAllMessages(store.getState());
      expect(allMessages.length).toBe(4);
      expect(allMessages).toContain(fileMessageA);
      expect(allMessages).toContain(projectMessageA);
      expect(allMessages).toContain(fileMessageB);
      expect(allMessages).toContain(projectMessageB);
    },
  );

  it(
    'An update from the same provider should overwrite previous messages from that' +
      ' provider.',
    () => {
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

      // spy_fileB is called with data from the initial state.
      expect(spy_fileB.calls.length).toBe(1);

      // spy_fileA, spy_project, and spy_allMessages are called with data from the
      // initial state and updateA2.
      expect(spy_fileA.calls.length).toBe(2);
      expect(spy_fileA.mostRecentCall.args).toEqual([
        {filePath: 'fileA', messages: [fileMessageA2]},
      ]);
      expect(spy_project.calls.length).toBe(2);
      expect(spy_project.mostRecentCall.args[0].length).toBe(2);
      expect(spy_project.mostRecentCall.args[0]).toContain(projectMessageA2);
      expect(spy_project.mostRecentCall.args[0]).toContain(projectMessageB);
      expect(spy_allMessages.calls.length).toBe(2);
      expect(spy_allMessages.mostRecentCall.args[0].length).toBe(4);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageA2);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(
        projectMessageA2,
      );
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageB);
      expect(spy_allMessages.mostRecentCall.args[0]).toContain(projectMessageB);

      // Expect the getter methods on DiagnosticStore to return the correct info.
      expect(Selectors.getFileMessages(store.getState(), 'fileA')).toEqual([
        fileMessageA2,
      ]);
      expect(Selectors.getFileMessages(store.getState(), 'fileB')).toEqual([
        fileMessageB,
      ]);
      const projectMessages = Selectors.getProjectMessages(store.getState());
      expect(projectMessages.length).toBe(2);
      expect(projectMessages).toContain(projectMessageA2);
      expect(projectMessages).toContain(projectMessageB);
      const allMessages = Selectors.getAllMessages(store.getState());
      expect(allMessages.length).toBe(4);
      expect(allMessages).toContain(fileMessageA2);
      expect(allMessages).toContain(projectMessageA2);
      expect(allMessages).toContain(fileMessageB);
      expect(allMessages).toContain(projectMessageB);
    },
  );

  describe('When an invalidation message is sent from one provider, ', () => {
    it(
      'if specifying file scope, it should only invalidate messages from that provider for that' +
        ' file.',
      () => {
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

        // Expect spy_fileA and spy_allMessages to have been called from the
        // invalidation message.
        // File messages from ProviderA should be gone, but no other changes.
        // At this point, there should be ProviderA project messages, and ProviderB
        // file and project messages.
        expect(spy_fileB.calls.length).toBe(1);
        expect(spy_project.calls.length).toBe(1);

        expect(spy_fileA.calls.length).toBe(2);
        expect(spy_fileA.mostRecentCall.args).toEqual([
          {filePath: 'fileA', messages: []},
        ]);
        expect(spy_allMessages.calls.length).toBe(2);
        expect(spy_allMessages.mostRecentCall.args[0].length).toBe(3);
        expect(spy_allMessages.mostRecentCall.args[0]).toContain(
          projectMessageA2,
        );
        expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageB);
        expect(spy_allMessages.mostRecentCall.args[0]).toContain(
          projectMessageB,
        );

        // Expect the getter methods on DiagnosticStore to return the correct info.
        expect(Selectors.getFileMessages(store.getState(), 'fileA')).toEqual(
          [],
        );
        expect(Selectors.getFileMessages(store.getState(), 'fileB')).toEqual([
          fileMessageB,
        ]);
        const projectMessages = Selectors.getProjectMessages(store.getState());
        expect(projectMessages.length).toBe(2);
        expect(projectMessages).toContain(projectMessageA2);
        expect(projectMessages).toContain(projectMessageB);
        const allMessages = Selectors.getAllMessages(store.getState());
        expect(allMessages.length).toBe(3);
        expect(allMessages).toContain(projectMessageA2);
        expect(allMessages).toContain(fileMessageB);
        expect(allMessages).toContain(projectMessageB);
      },
    );

    it(
      'if specifying project scope, it should only invalidate project-scope messages from that' +
        ' provider.',
      () => {
        // Set up the state of the store.
        addUpdateB();
        addUpdateA2();
        const fileInvalidationMessage = {scope: 'file', filePaths: ['fileA']};
        store.dispatch(
          Actions.invalidateMessages(dummyProviderA, fileInvalidationMessage),
        );

        // Register spies. All spies expect spy_fileA should be called immediately
        // because there is relevant data in the store.
        setSpies();

        // Test 4B. Invalidate project messages from ProviderA.
        const projectInvalidationMessage = {scope: 'project'};
        store.dispatch(
          Actions.invalidateMessages(
            dummyProviderA,
            projectInvalidationMessage,
          ),
        );

        // Expect spy_project and spy_allMessages to have been called from the
        // invalidation message.
        // At this point, there should be no ProviderA messages, and ProviderB file
        // and project messages.
        expect(spy_fileA.callCount).toBe(1);
        expect(spy_fileA).toHaveBeenCalledWith({
          filePath: 'fileA',
          messages: [],
        });
        expect(spy_fileB.callCount).toBe(1);

        expect(spy_project.calls.length).toBe(2);
        expect(spy_project.mostRecentCall.args[0].length).toBe(1);
        expect(spy_project.mostRecentCall.args[0]).toContain(projectMessageB);
        expect(spy_allMessages.calls.length).toBe(2);
        expect(spy_allMessages.mostRecentCall.args[0].length).toBe(2);
        expect(spy_allMessages.mostRecentCall.args[0]).toContain(fileMessageB);
        expect(spy_allMessages.mostRecentCall.args[0]).toContain(
          projectMessageB,
        );

        // Expect the getter methods on DiagnosticStore to return the correct info.
        expect(Selectors.getFileMessages(store.getState(), 'fileA')).toEqual(
          [],
        );
        expect(Selectors.getFileMessages(store.getState(), 'fileB')).toEqual([
          fileMessageB,
        ]);
        const projectMessages = Selectors.getProjectMessages(store.getState());
        expect(projectMessages.length).toBe(1);
        expect(projectMessages).toContain(projectMessageB);
        const allMessages = Selectors.getAllMessages(store.getState());
        expect(allMessages.length).toBe(2);
        expect(allMessages).toContain(fileMessageB);
        expect(allMessages).toContain(projectMessageB);
      },
    );
  });

  it('When callbacks are unregistered, they are not messaged with updates.', () => {
    // Set up the state of the store.
    addUpdateB();

    // Register spies. Spies should be called immediately because there is relevant data in the
    // store.
    setSpies();
    expect(spy_fileA.callCount).toBe(1);
    expect(spy_fileB.callCount).toBe(1);
    expect(spy_project.callCount).toBe(1);
    expect(spy_allMessages.callCount).toBe(1);

    // Test 5. Remove listeners, then invalidate all messages from ProviderB.
    // We don't need to remove spy_fileA_subscription -- it shouldn't be called anyway.
    invariant(spy_fileB_subscription);
    spy_fileB_subscription.dispose();
    invariant(spy_project_subscription);
    spy_project_subscription.dispose();
    invariant(spy_allMessages_subscription);
    spy_allMessages_subscription.dispose();

    // All messages from ProviderB should be removed.
    const providerInvalidationMessage = {scope: 'all'};
    store.dispatch(
      Actions.invalidateMessages(dummyProviderB, providerInvalidationMessage),
    );

    // There should have been no additional calls on the spies.
    expect(spy_fileA.callCount).toBe(1);
    expect(spy_fileB.callCount).toBe(1);
    expect(spy_project.callCount).toBe(1);
    expect(spy_allMessages.callCount).toBe(1);

    // Expect the getter methods on DiagnosticStore to return the correct info.
    expect(Selectors.getFileMessages(store.getState(), 'fileA')).toEqual([]);
    expect(Selectors.getFileMessages(store.getState(), 'fileB')).toEqual([]);
    expect(Selectors.getProjectMessages(store.getState()).length).toBe(0);
    expect(Selectors.getAllMessages(store.getState()).length).toBe(0);
  });

  describe('autofix', () => {
    const messageWithAutofix = {
      scope: 'file',
      providerName: 'dummyProviderA',
      type: 'Error',
      filePath: '/tmp/fileA',
      fix: {
        oldRange: new Range([0, 0], [0, 1]),
        newText: 'FOO',
      },
    };

    let editor: atom$TextEditor = (null: any);

    beforeEach(() => {
      waitsForPromise(async () => {
        editor = await atom.workspace.open('/tmp/fileA');
        editor.setText('foobar\n');
        store.dispatch(
          Actions.updateMessages(dummyProviderA, {
            filePathToMessages: new Map([['/tmp/fileA', [messageWithAutofix]]]),
            projectMessages: [],
          }),
        );
      });
    });

    describe('applyFix', () => {
      it('should apply the fix to the editor', () => {
        store.dispatch(Actions.applyFix(messageWithAutofix));
        expect(editor.getText()).toEqual('FOOoobar\n');
      });

      it('should invalidate the message', () => {
        expect(
          Selectors.getFileMessages(store.getState(), '/tmp/fileA'),
        ).toEqual([messageWithAutofix]);
        store.dispatch(Actions.applyFix(messageWithAutofix));
        expect(
          Selectors.getFileMessages(store.getState(), '/tmp/fileA'),
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
