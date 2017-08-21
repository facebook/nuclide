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
import semver from 'semver';
import temp from 'temp';
import * as config from '../lib/config';
import CodeFormatManager from '../lib/CodeFormatManager';

describe('CodeFormatManager', () => {
  let textEditor;
  beforeEach(() => {
    waitsForPromise(async () => {
      temp.track();
      const file = temp.openSync();
      textEditor = await atom.workspace.open(file.path);
    });
  });

  it('formats an editor on request', () => {
    waitsForPromise(async () => {
      const manager = new CodeFormatManager();
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
      waitsFor(() => textEditor.getText() === 'def');
    });
  });

  it('format an editor using formatEntireFile', () => {
    waitsForPromise(async () => {
      const manager = new CodeFormatManager();
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
      waitsFor(() => textEditor.getText() === 'ghi');
    });
  });

  it('formats an editor on type', () => {
    waitsForPromise(async () => {
      const manager = new CodeFormatManager();
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
      };
      const spy = spyOn(provider, 'formatAtPosition').andCallThrough();
      manager.addOnTypeProvider(provider);

      textEditor.setText('a');
      textEditor.setCursorBufferPosition([0, 1]);
      textEditor.insertText('b');
      textEditor.insertText('c');

      waitsFor(() => textEditor.getText() === 'def');
      runs(() => {
        // Debouncing should ensure only one format call.
        expect(spy.callCount).toBe(1);
      });
    });
  });

  it('formats an editor on save', () => {
    waitsForPromise(async () => {
      spyOn(config, 'getFormatOnSave').andReturn(true);
      const manager = new CodeFormatManager();
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
      textEditor.save();
      waitsFor(() => textEditor.getText() === 'def');
    });
  });

  // TODO(19829039): remove check
  if (semver.gte(atom.getVersion(), '1.19.0-beta0')) {
    it('formats an editor on save in 1.19', () => {
      waitsForPromise(async () => {
        spyOn(config, 'getFormatOnSave').andReturn(true);
        const manager = new CodeFormatManager();
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
    });
  }

  it('should still save on timeout', () => {
    waitsForPromise(async () => {
      jasmine.Clock.useMock();
      spyOn(config, 'getFormatOnSave').andReturn(true);
      const manager = new CodeFormatManager();
      manager.addRangeProvider({
        grammarScopes: ['text.plain.null-grammar'],
        priority: 1,
        formatCode: () => new Promise(() => {}),
      });

      const spy = spyOn(textEditor.getBuffer(), 'save').andCallThrough();
      textEditor.save();
      const savePromise = Promise.resolve(textEditor.save());

      // The first save should be pushed through after the 2nd.
      waitsFor(() => spy.callCount === 1);

      runs(() => {
        jasmine.Clock.tick(3000);
      });

      // Hitting the timeout will force the 2nd save through.
      waitsFor(() => spy.callCount === 2);

      // The real save should still go through.
      waitsForPromise(() => savePromise);

      // Sanity check.
      runs(() => expect(spy.callCount).toBe(2));
    });
  });
});
