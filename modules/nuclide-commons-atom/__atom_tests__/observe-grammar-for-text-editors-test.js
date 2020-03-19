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
import fsPromise from 'nuclide-commons/fsPromise';
import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri';
import observeGrammarForTextEditors from '../observe-grammar-for-text-editors';

describe('observeGrammarForTextEditors', () => {
  let objcGrammar: atom$Grammar = (null: any);
  let jsGrammar: atom$Grammar = (null: any);
  let tempFilename: string = (null: any);

  beforeEach(async () => {
    observeGrammarForTextEditors.__reset__();
    // The grammar registry is cleared automatically after Atom 1.3.0+
    atom.grammars.clear();
    atom.grammars.loadGrammarSync(
      nuclideUri.join(__dirname, '../__mocks__/grammars/objective-c.cson'),
    );
    objcGrammar = nullthrows(atom.grammars.grammarForScopeName('source.objc'));
    atom.grammars.loadGrammarSync(
      nuclideUri.join(__dirname, '../__mocks__/grammars/javascript.cson'),
    );
    jsGrammar = nullthrows(atom.grammars.grammarForScopeName('source.js'));
    tempFilename = `${await fsPromise.tempfile()}.m`;
  });

  it('calls for existing text editors', async () => {
    const textEditor = await atom.workspace.open(tempFilename);

    const fn: any = jest.fn();
    const subscription = observeGrammarForTextEditors(fn);
    expect(fn).toHaveBeenCalledWith(textEditor, objcGrammar);
    expect(fn.mock.calls.length).toBe(1);

    subscription.dispose();
    textEditor.destroy();
  });

  it('calls for new text editors', async () => {
    const fn: any = jest.fn();
    const subscription = observeGrammarForTextEditors(fn);
    const textEditor = await atom.workspace.open(tempFilename);

    expect(fn).toHaveBeenCalledWith(textEditor, objcGrammar);
    expect(fn.mock.calls.length).toBe(1);

    subscription.dispose();
    textEditor.destroy();
  });

  it('calls when a text editor changes grammars', async () => {
    const fn: any = jest.fn();
    const subscription = observeGrammarForTextEditors(fn);
    const textEditor = await atom.workspace.open(tempFilename);
    textEditor.setGrammar(jsGrammar);

    expect(fn).toHaveBeenCalledWith(textEditor, objcGrammar);
    expect(fn).toHaveBeenCalledWith(textEditor, jsGrammar);
    expect(fn.mock.calls.length).toBe(2);

    subscription.dispose();
    textEditor.destroy();
  });

  it('does not call after the return value is disposed', async () => {
    const fn: any = jest.fn();
    const subscription = observeGrammarForTextEditors(fn);
    const textEditor = await atom.workspace.open(tempFilename);

    subscription.dispose();
    textEditor.setGrammar(jsGrammar);

    expect(fn).toHaveBeenCalledWith(textEditor, objcGrammar);
    expect(fn.mock.calls.length).toBe(1);

    subscription.dispose();
    textEditor.destroy();
  });

  it('calls for other clients after another listener is disposed', async () => {
    const fn: any = jest.fn();
    const subscription = observeGrammarForTextEditors(fn);
    const fn2: any = jest.fn();
    const subscription2 = observeGrammarForTextEditors(fn2);
    const textEditor = await atom.workspace.open(tempFilename);

    subscription.dispose();

    textEditor.setGrammar(jsGrammar);

    expect(fn).toHaveBeenCalledWith(textEditor, objcGrammar);
    expect(fn.mock.calls.length).toBe(1);
    expect(fn2).toHaveBeenCalledWith(textEditor, objcGrammar);
    expect(fn2).toHaveBeenCalledWith(textEditor, jsGrammar);
    expect(fn2.mock.calls.length).toBe(2);

    subscription2.dispose();
    textEditor.destroy();
  });
});
