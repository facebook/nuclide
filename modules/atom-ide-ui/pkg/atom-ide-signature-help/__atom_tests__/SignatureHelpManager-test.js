/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import type {DatatipService} from '../../atom-ide-datatip/lib/types';
import type {SignatureHelp, SignatureHelpProvider} from '../lib/types';

import {Point, Range} from 'atom';
import {attachWorkspace} from 'nuclide-commons-atom/test-helpers';
import {nextTick} from 'nuclide-commons/promise';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import waitsFor from '../../../../../jest/waits_for';
import path from 'path';

const sleep = n => new Promise(r => setTimeout(r, n));

describe.skip('SignatureHelpManager', () => {
  let disposable: IDisposable;
  let testProvider: SignatureHelpProvider;
  let mockDatatipService: DatatipService;
  let editor: atom$TextEditor;

  beforeEach(async () => {
    attachWorkspace();
    atom.packages.activatePackage(path.resolve(__dirname, '../'));

    editor = await atom.workspace.open();

    testProvider = {
      priority: 1,
      grammarScopes: ['text.plain.null-grammar'],
      triggerCharacters: new Set(['(']),
      getSignatureHelp: jest.fn().mockReturnValue(
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
        throw new Error();
      },
      addModifierProvider() {
        throw new Error();
      },
      createPinnedDataTip: jest.fn().mockReturnValue(new UniversalDisposable()),
    };
    atom.packages.serviceHub.consume('signature-help', '0.1.0', registry => {
      disposable = registry(testProvider);
    });
    atom.packages.serviceHub.provide('datatip', '0.1.0', mockDatatipService);

    // Active editor debounce.
    await sleep(500);
  });

  afterEach(() => {
    disposable.dispose();
  });

  it('responds to manual triggers', async () => {
    editor.insertText('test');
    atom.commands.dispatch(editor.getElement(), 'signature-help:show');

    await waitsFor(() => testProvider.getSignatureHelp.mock.calls.length > 0);
    const signatureSpy = testProvider.getSignatureHelp;
    expect(signatureSpy.mock.calls.length).toBe(1);
    expect(signatureSpy.calls[0].args).toEqual([editor, new Point(0, 4)]);

    // Wait for promise to be resolved.
    await nextTick();

    const datatipSpy = mockDatatipService.createPinnedDataTip;
    expect(datatipSpy.mock.calls.length).toBe(1);
    expect(datatipSpy.calls[0][0].range).toEqual(new Range([0, 4], [0, 4]));

    // Moving the cursor should immediately move the datatip and query again.
    editor.setCursorBufferPosition([0, 3]);

    expect(datatipSpy.mock.calls.length).toBe(2);
    expect(datatipSpy.calls[1][0].range).toEqual(new Range([0, 3], [0, 3]));

    // Compensate for the debounce.
    await sleep(500);
    expect(signatureSpy.mock.calls.length).toBe(2);
    expect(signatureSpy.calls[1].args).toEqual([editor, new Point(0, 3)]);

    // Wait for promise to be resolved.
    await nextTick();
    expect(datatipSpy.mock.calls.length).toBe(3);

    // Once the signature returns null, abort the flow.
    signatureSpy.mockReturnValue(Promise.resolve(null));
    editor.setCursorBufferPosition([0, 0]);

    // No repositioning when the cursor moves too far.
    expect(datatipSpy.mock.calls.length).toBe(3);

    // Compensate for the debounce.
    await sleep(500);
    expect(signatureSpy.mock.calls.length).toBe(3);

    await nextTick();
    expect(datatipSpy.mock.calls.length).toBe(3);

    editor.setCursorBufferPosition([0, 1]);
    await sleep(500);
    expect(signatureSpy.mock.calls.length).toBe(3);
  });

  it('responds to typing trigger characters', async () => {
    editor.insertText('a');
    await sleep(1); // debounce
    const signatureSpy = testProvider.getSignatureHelp;
    expect(signatureSpy.mock.calls.length).toBe(0);

    editor.insertText('(');
    await sleep(1); // debounce
    expect(signatureSpy.mock.calls.length).toBe(1);
    expect(signatureSpy.calls[0].args).toEqual([editor, new Point(0, 2)]);

    // We've tested the regular flow above; test cancellation too.
    /* global KeyboardEvent */
    const escape = new KeyboardEvent('keydown');
    // No APi to set keyCode :(
    Object.defineProperty(escape, 'keyCode', {value: 27});
    editor.getElement().dispatchEvent(escape);

    // Contains a trigger character, but has the wrong cursor.
    editor.insertText('x(y');
    await sleep(500); // debounce
    expect(signatureSpy.mock.calls.length).toBe(1);

    // Test the autocomplete-plus scenario: insertion + selection
    const startCol = editor.getCursorBufferPosition().column;
    editor.insertText('abc(arg1, arg2)');
    editor.setSelectedBufferRange([[0, startCol + 4], [0, startCol + 7]]);
    await sleep(1); // debounce
    expect(signatureSpy.mock.calls.length).toBe(2);
  });

  it('responds to typing over a selection', async () => {
    editor.setText('(abcdef');
    await sleep(1); // debounce
    const signatureSpy = testProvider.getSignatureHelp;
    expect(signatureSpy.mock.calls.length).toBe(0);

    editor.setSelectedBufferRange(new Range([0, 0], [0, 1]));
    editor.insertText('(');
    expect(editor.getText()).toBe('(abcdef');
    await sleep(1); // debounce
    expect(signatureSpy.mock.calls.length).toBe(1);
    expect(signatureSpy.calls[0].args).toEqual([editor, new Point(0, 1)]);
  });

  it('can be dynamically toggled via config', async () => {
    atom.config.set('atom-ide-signature-help.enable', false);

    editor.setText('test');
    await sleep(1); // debounce
    const signatureSpy = testProvider.getSignatureHelp;
    expect(signatureSpy.mock.calls.length).toBe(0);

    editor.insertText('(');
    expect(editor.getText()).toBe('test(');
    await sleep(1); // debounce
    expect(signatureSpy.mock.calls.length).toBe(0);

    atom.config.set('atom-ide-signature-help.enable', true);

    editor.insertText('(');
    expect(editor.getText()).toBe('test((');
    await sleep(1); // debounce
    expect(signatureSpy.mock.calls.length).toBe(1);
  });
});
