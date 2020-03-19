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
import type {DiagnosticMessage} from '../lib/types';

import invariant from 'assert';
import {Range} from 'atom';

import MessageRangeTracker from '../lib/MessageRangeTracker';

import nuclideUri from 'nuclide-commons/nuclideUri';

describe('MessageRangeTracker', () => {
  let tracker: MessageRangeTracker = (null: any);

  let initiallyOpenFilePath: string = (null: any);
  let initiallyClosedFilePath: string = (null: any);

  let messageForInitiallyOpenFile: DiagnosticMessage = (null: any);
  let messageForInitiallyClosedFile: DiagnosticMessage = (null: any);

  let initiallyOpenEditor: atom$TextEditor = (null: any);

  beforeEach(async () => {
    tracker = new MessageRangeTracker();

    const fixturesPath = nuclideUri.join(__dirname, '../__mocks__/fixtures');
    initiallyOpenFilePath = nuclideUri.join(
      fixturesPath,
      'initiallyOpenFile.txt',
    );
    initiallyClosedFilePath = nuclideUri.join(
      fixturesPath,
      'initiallyClosedFile.txt',
    );

    messageForInitiallyOpenFile = {
      providerName: 'test',
      type: 'Error',
      filePath: initiallyOpenFilePath,
      text: 'something is wrong',
      range: new Range([1, 18], [1, 22]),
      fix: {
        oldRange: new Range([1, 18], [1, 22]),
        oldText: 'test',
        newText: 'fix',
      },
    };

    messageForInitiallyClosedFile = {
      providerName: 'test',
      type: 'Error',
      filePath: initiallyClosedFilePath,
      text: 'something is wrong',
      range: new Range([1, 4], [1, 31]),
      fix: {
        oldRange: new Range([1, 4], [1, 31]),
        oldText: 'at first this one is closed',
        newText: 'now this one is open',
      },
    };

    initiallyOpenEditor = await atom.workspace.open(initiallyOpenFilePath);
  });

  afterEach(() => {
    for (const editor of atom.workspace.getTextEditors()) {
      editor.destroy();
    }
  });

  it('should return ranges for already-open files', () => {
    tracker.addFileMessages([messageForInitiallyOpenFile]);
    const range = tracker.getCurrentRange(messageForInitiallyOpenFile);
    invariant(range != null);
    expect(range.isEqual(new Range([1, 18], [1, 22]))).toBeTruthy();
    checkRep(tracker);
  });

  it('should correctly track changes using markers', () => {
    tracker.addFileMessages([messageForInitiallyOpenFile]);
    initiallyOpenEditor.setTextInBufferRange(
      new Range([1, 3], [1, 11]),
      'are using',
    );
    const range = tracker.getCurrentRange(messageForInitiallyOpenFile);
    invariant(range != null);
    expect(range.isEqual(new Range([1, 19], [1, 23]))).toBeTruthy();
    checkRep(tracker);
  });

  it('should invalidate fixes where the oldRange has been touched', () => {
    tracker.addFileMessages([messageForInitiallyOpenFile]);
    initiallyOpenEditor.setTextInBufferRange(new Range([1, 20], [1, 21]), '');
    const range = tracker.getCurrentRange(messageForInitiallyOpenFile);
    expect(range).toBeNull();
    checkRep(tracker);
  });

  it('should add markers to files when they are opened', async () => {
    tracker.addFileMessages([messageForInitiallyClosedFile]);
    checkRep(tracker);
    expect(tracker.getCurrentRange(messageForInitiallyClosedFile)).toBeNull();
    const initiallyClosedEditor = await atom.workspace.open(
      initiallyClosedFilePath,
    );
    let range = tracker.getCurrentRange(messageForInitiallyClosedFile);
    invariant(range != null);
    expect(range.isEqual(new Range([1, 4], [1, 31]))).toBeTruthy();

    initiallyClosedEditor.setTextInBufferRange(
      new Range([0, 16], [0, 16]),
      '\n',
    );

    range = tracker.getCurrentRange(messageForInitiallyClosedFile);
    invariant(range != null);
    expect(range.isEqual(new Range([2, 4], [2, 31]))).toBeTruthy();
    checkRep(tracker);
  });

  // The tests below break the MessageRangeTracker abstraction so that they can ensure that disposal
  // happens properly.

  it('should remove messages for open files and destroy markers', () => {
    tracker.addFileMessages([messageForInitiallyOpenFile]);
    const messageSet = tracker._fileToMessages.get(initiallyOpenFilePath);
    invariant(messageSet != null);
    expect(messageSet.has(messageForInitiallyOpenFile)).toBeTruthy();
    const marker = tracker._messageToMarker.get(messageForInitiallyOpenFile);
    invariant(marker != null);

    checkRep(tracker);

    tracker.removeFileMessages([messageForInitiallyOpenFile]);
    expect(tracker._fileToMessages.hasAny(initiallyOpenFilePath)).toBeFalsy();
    expect(
      tracker._messageToMarker.has(messageForInitiallyOpenFile),
    ).toBeFalsy();
    expect(marker.isDestroyed()).toBeTruthy();

    checkRep(tracker);
  });

  it('should remove messages for closed files', () => {
    tracker.addFileMessages([messageForInitiallyClosedFile]);
    expect(
      tracker._messageToMarker.has(messageForInitiallyClosedFile),
    ).toBeFalsy();
    const messagesSet = tracker._fileToMessages.get(initiallyClosedFilePath);
    invariant(messagesSet != null);
    expect(messagesSet.has(messageForInitiallyClosedFile)).toBeTruthy();

    tracker.removeFileMessages([messageForInitiallyClosedFile]);
    expect(tracker._fileToMessages.hasAny(initiallyClosedFilePath)).toBeFalsy();

    checkRep(tracker);
  });

  it('should properly clean up when a text buffer is closed', () => {
    tracker.addFileMessages([messageForInitiallyOpenFile]);
    const marker = tracker._messageToMarker.get(messageForInitiallyOpenFile);
    invariant(marker != null);

    initiallyOpenEditor.destroy();

    const messageSet = tracker._fileToMessages.get(initiallyOpenFilePath);
    invariant(messageSet != null);

    expect(messageSet.has(messageForInitiallyOpenFile)).toBeTruthy();

    expect(
      tracker._messageToMarker.has(messageForInitiallyOpenFile),
    ).toBeFalsy();

    expect(marker.isDestroyed()).toBeTruthy();

    checkRep(tracker);
  });

  it('should clean up when disposed', () => {
    tracker.addFileMessages([messageForInitiallyOpenFile]);
    const marker = tracker._messageToMarker.get(messageForInitiallyOpenFile);
    invariant(marker != null);

    expect(marker.isDestroyed()).toBeFalsy();
    tracker.dispose();
    expect(marker.isDestroyed()).toBeTruthy();

    expect(tracker._fileToMessages.size).toBe(0);
    expect(tracker._messageToMarker.size).toBe(0);

    checkRep(tracker);
  });
});

/**
 * Ensures that the representation invariants hold. Obviously, this breaks abstraction by reaching
 * into private properties.
 */
function checkRep(tracker: MessageRangeTracker): void {
  const openFiles = new Set(
    atom.workspace.getTextEditors().map(editor => editor.getPath()),
  );

  for (const message of tracker._messageToMarker.keys()) {
    expect(openFiles.has(message.filePath)).toBeTruthy();
  }

  for (const marker of tracker._messageToMarker.values()) {
    expect(marker.isDestroyed()).toBeFalsy();
  }
}
