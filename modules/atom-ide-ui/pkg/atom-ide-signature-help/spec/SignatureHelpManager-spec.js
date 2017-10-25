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

import type {DatatipService} from '../../atom-ide-datatip/lib/types';
import type {SignatureHelp, SignatureHelpProvider} from '../lib/types';

import {Point, Range} from 'atom';
import {jasmineAttachWorkspace} from 'nuclide-commons-atom/test-helpers';
import {nextTick} from 'nuclide-commons/promise';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

describe('SignatureHelpManager', () => {
  let disposable: IDisposable;
  let testProvider: SignatureHelpProvider;
  let mockDatatipService: DatatipService;
  let editor: atom$TextEditor;

  beforeEach(() => {
    waitsForPromise(async () => {
      jasmineAttachWorkspace();
      jasmine.useMockClock();
      atom.packages.activatePackage('atom-ide-signature-help');

      editor = await atom.workspace.open();

      testProvider = {
        priority: 1,
        grammarScopes: ['text.plain.null-grammar'],
        triggerCharacters: new Set(['(']),
        getSignatureHelp: jasmine.createSpy().andReturn(
          Promise.resolve(
            ({
              signatures: [
                {
                  label: 'test signature',
                },
              ],
            }: SignatureHelp),
          ),
        ),
      };
      mockDatatipService = {
        addProvider() {
          throw Error();
        },
        addModifierProvider() {
          throw Error();
        },
        createPinnedDataTip: jasmine
          .createSpy()
          .andReturn(new UniversalDisposable()),
      };
      atom.packages.serviceHub.consume('signature-help', '0.1.0', registry => {
        disposable = registry(testProvider);
      });
      atom.packages.serviceHub.provide('datatip', '0.1.0', mockDatatipService);

      // Active editor debounce.
      advanceClock(500);
    });
  });

  afterEach(() => {
    disposable.dispose();
  });

  it('responds to manual triggers', () => {
    waitsForPromise(async () => {
      editor.insertText('test');
      atom.commands.dispatch(editor.getElement(), 'signature-help:show');

      const signatureSpy = testProvider.getSignatureHelp;
      expect(signatureSpy.callCount).toBe(1);
      expect(signatureSpy.calls[0].args).toEqual([editor, new Point(0, 4)]);

      // Wait for promise to be resolved.
      await nextTick();

      const datatipSpy = mockDatatipService.createPinnedDataTip;
      expect(datatipSpy.callCount).toBe(1);
      expect(datatipSpy.calls[0].args[0].range).toEqual(
        new Range([0, 4], [0, 4]),
      );

      // Moving the cursor should immediately move the datatip and query again.
      editor.setCursorBufferPosition([0, 3]);

      expect(datatipSpy.callCount).toBe(2);
      expect(datatipSpy.calls[1].args[0].range).toEqual(
        new Range([0, 3], [0, 3]),
      );

      // Compensate for the debounce.
      advanceClock(500);
      expect(signatureSpy.callCount).toBe(2);
      expect(signatureSpy.calls[1].args).toEqual([editor, new Point(0, 3)]);

      // Wait for promise to be resolved.
      await nextTick();
      expect(datatipSpy.callCount).toBe(3);

      // Once the signature returns null, abort the flow.
      signatureSpy.andReturn(Promise.resolve(null));
      editor.setCursorBufferPosition([0, 0]);

      // No repositioning when the cursor moves too far.
      expect(datatipSpy.callCount).toBe(3);

      // Compensate for the debounce.
      advanceClock(500);
      expect(signatureSpy.callCount).toBe(3);

      await nextTick();
      expect(datatipSpy.callCount).toBe(3);

      editor.setCursorBufferPosition([0, 1]);
      advanceClock(500);
      expect(signatureSpy.callCount).toBe(3);
    });
  });

  it('responds to typing trigger characters', () => {
    waitsForPromise(async () => {
      editor.insertText('a');
      advanceClock(1); // debounce
      const signatureSpy = testProvider.getSignatureHelp;
      expect(signatureSpy.callCount).toBe(0);

      editor.insertText('(');
      advanceClock(1); // debounce
      expect(signatureSpy.callCount).toBe(1);
      expect(signatureSpy.calls[0].args).toEqual([editor, new Point(0, 2)]);

      // We've tested the regular flow above; test cancellation too.
      /* global KeyboardEvent */
      const escape = new KeyboardEvent('keydown');
      // No APi to set keyCode :(
      Object.defineProperty(escape, 'keyCode', {value: 27});
      editor.getElement().dispatchEvent(escape);

      editor.insertText('x');
      advanceClock(500); // debounce
      expect(signatureSpy.callCount).toBe(1);
    });
  });

  it('responds to typing over a selection', () => {
    waitsForPromise(async () => {
      editor.setText('(abcdef');
      advanceClock(1); // debounce
      const signatureSpy = testProvider.getSignatureHelp;
      expect(signatureSpy.callCount).toBe(0);

      editor.setSelectedBufferRange(new Range([0, 0], [0, 1]));
      editor.insertText('(');
      expect(editor.getText()).toBe('(abcdef');
      advanceClock(1); // debounce
      expect(signatureSpy.callCount).toBe(1);
      expect(signatureSpy.calls[0].args).toEqual([editor, new Point(0, 1)]);
    });
  });
});
