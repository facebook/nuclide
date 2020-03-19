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
import {observeTextEditors} from 'nuclide-commons-atom/FileEventHandlers';
import {SAVE_TIMEOUT} from '../lib/CodeFormatManager';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import temp from 'temp';
import * as config from '../lib/config';
import CodeFormatManager from '../lib/CodeFormatManager';
import waitsFor from '../../../../../jest/waits_for';

const sleep = n => new Promise(r => setTimeout(r, n));

describe('CodeFormatManager', () => {
  let textEditor;
  let manager;
  let disposables;
  beforeEach(async () => {
    manager = new CodeFormatManager();
    disposables = new UniversalDisposable(observeTextEditors());
    temp.track();
    const file = temp.openSync();
    textEditor = await atom.workspace.open(file.path);
  });

  afterEach(async () => {
    manager.dispose();
    disposables.dispose();
  });

  it('formats an editor on request', async () => {
    manager.addRangeProvider({
      grammarScopes: ['text.plain.null-grammar'],
      priority: 1,
      formatCode: () =>
        Promise.resolve([
          {
            oldRange: new Range([0, 0], [0, 3]),
            oldText: 'abc',
            newText: 'def',
          },
        ]),
    });

    textEditor.setText('abc');
    atom.commands.dispatch(
      atom.views.getView(textEditor),
      'code-format:format-code',
    );
    await waitsFor(() => textEditor.getText() === 'def');
  });

  it('format an editor using formatEntireFile', async () => {
    manager.addFileProvider({
      grammarScopes: ['text.plain.null-grammar'],
      priority: 1,
      formatEntireFile: () => Promise.resolve({formatted: 'ghi'}),
    });

    textEditor.setText('abc');
    atom.commands.dispatch(
      atom.views.getView(textEditor),
      'code-format:format-code',
    );
    await waitsFor(() => textEditor.getText() === 'ghi');
  });

  it('formats an editor on type', async () => {
    jest.spyOn(config, 'getFormatOnType').mockReturnValue(true);
    const provider = {
      grammarScopes: ['text.plain.null-grammar'],
      priority: 1,
      formatAtPosition: () =>
        Promise.resolve([
          {
            oldRange: new Range([0, 0], [0, 3]),
            oldText: 'abc',
            newText: 'def',
          },
        ]),
      keepCursorPosition: false,
    };
    const spy = jest.spyOn(provider, 'formatAtPosition');
    manager.addOnTypeProvider(provider);

    textEditor.setText('a');
    textEditor.setCursorBufferPosition([0, 1]);
    textEditor.insertText('b');
    textEditor.insertText('c');

    await waitsFor(() => textEditor.getText() === 'def');
    // Debouncing should ensure only one format call.
    expect(spy.mock.calls.length).toBe(1);
  });

  it('formats an editor on save', async () => {
    jest.spyOn(config, 'getFormatOnSave').mockReturnValue(true);
    manager.addOnSaveProvider({
      grammarScopes: ['text.plain.null-grammar'],
      priority: 1,
      formatOnSave: () =>
        Promise.resolve([
          {
            oldRange: new Range([0, 0], [0, 3]),
            oldText: 'abc',
            newText: 'def',
          },
        ]),
    });

    textEditor.setText('abc');
    await textEditor.save();
    expect(textEditor.getText()).toBe('def');
  });

  it('should still save on timeout', async () => {
    jest.spyOn(config, 'getFormatOnSave').mockReturnValue(true);
    manager.addRangeProvider({
      grammarScopes: ['text.plain.null-grammar'],
      priority: 1,
      formatCode: async () => {
        await sleep(SAVE_TIMEOUT + 1000);
        return [];
      },
    });

    const spy = jest.spyOn(textEditor.getBuffer(), 'save');
    textEditor.save();

    // Wait until the buffer has been saved and verify it has been saved exactly
    // once.
    await waitsFor(() => spy.mock.calls.length > 0);
    expect(spy.mock.calls.length).toBe(1);
  });
});
