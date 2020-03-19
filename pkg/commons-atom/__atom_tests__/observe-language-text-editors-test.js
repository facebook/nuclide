/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import fsPromise from 'nuclide-commons/fsPromise';
import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri';
import observeGrammarForTextEditors from 'nuclide-commons-atom/observe-grammar-for-text-editors';
import observeLanguageTextEditors from '../observe-language-text-editors';
import path from 'path';

const MOCK_DIR = path.resolve(__dirname, '../__mocks__');

describe('observeLanguageTextEditors', () => {
  let objcGrammar: atom$Grammar = (null: any);
  let javaGrammar: atom$Grammar = (null: any);
  let jsGrammar: atom$Grammar = (null: any);
  let nullGrammar: atom$Grammar = (null: any);
  let grammarScopes: Array<string> = (null: any);
  let tempFilenameJS: string = (null: any);
  let tempFilenameObjC: string = (null: any);

  beforeEach(async () => {
    observeGrammarForTextEditors.__reset__();
    atom.grammars.loadGrammarSync(
      nuclideUri.join(MOCK_DIR, 'grammars/objective-c.cson'),
    );
    objcGrammar = nullthrows(atom.grammars.grammarForScopeName('source.objc'));

    atom.grammars.loadGrammarSync(
      nuclideUri.join(MOCK_DIR, 'grammars/java.cson'),
    );
    javaGrammar = nullthrows(atom.grammars.grammarForScopeName('source.java'));

    atom.grammars.loadGrammarSync(
      nuclideUri.join(MOCK_DIR, 'grammars/javascript.cson'),
    );
    jsGrammar = nullthrows(atom.grammars.grammarForScopeName('source.js'));
    nullGrammar = nullthrows(
      atom.grammars.grammarForScopeName('text.plain.null-grammar'),
    );

    grammarScopes = [objcGrammar.scopeName, javaGrammar.scopeName];

    tempFilenameJS = `${await fsPromise.tempfile()}.js`;
    tempFilenameObjC = `${await fsPromise.tempfile()}.m`;
  });

  describe('without cleanup function', () => {
    it('calls for existing text editors that match the grammars', async () => {
      const textEditor = await atom.workspace.open(tempFilenameObjC);

      const fn: any = jest.fn();
      const subscription = observeLanguageTextEditors(grammarScopes, fn);

      expect(fn).toHaveBeenCalledWith(textEditor);
      expect(fn.mock.calls.length).toBe(1);

      subscription.dispose();
      textEditor.destroy();
    });

    it('calls for new text editors that already match the grammars', async () => {
      const fn: any = jest.fn();
      const subscription = observeLanguageTextEditors(grammarScopes, fn);

      const textEditor = await atom.workspace.open(tempFilenameObjC);

      expect(fn).toHaveBeenCalledWith(textEditor);
      expect(fn.mock.calls.length).toBe(1);

      subscription.dispose();
      textEditor.destroy();
    });

    it('calls for new text editors that change to match the grammars', async () => {
      const fn: any = jest.fn();
      const subscription = observeLanguageTextEditors(grammarScopes, fn);

      const textEditor = await atom.workspace.open();
      textEditor.setGrammar(objcGrammar);

      expect(fn).toHaveBeenCalledWith(textEditor);
      expect(fn.mock.calls.length).toBe(1);

      subscription.dispose();
      textEditor.destroy();
    });

    it("does not call for new text editors that change and still don't match the grammars", async () => {
      const fn: any = jest.fn();
      const subscription = observeLanguageTextEditors(grammarScopes, fn);

      const textEditor = await atom.workspace.open();
      textEditor.setGrammar(jsGrammar);

      expect(fn.mock.calls.length).toBe(0);

      subscription.dispose();
      textEditor.destroy();
    });

    it('does not call for text editors whose matching grammar changes but still matches', async () => {
      const fn: any = jest.fn();
      const subscription = observeLanguageTextEditors(grammarScopes, fn);

      const textEditor = await atom.workspace.open(tempFilenameObjC);
      textEditor.setGrammar(javaGrammar);

      expect(fn).toHaveBeenCalledWith(textEditor);
      expect(fn.mock.calls.length).toBe(1);

      subscription.dispose();
      textEditor.destroy();
    });

    it('stops listening to grammar changes on text editors that are destroyed', async () => {
      const fn: any = jest.fn();
      const subscription = observeLanguageTextEditors(grammarScopes, fn);

      const textEditor = await atom.workspace.open(tempFilenameObjC);
      textEditor.destroy();

      subscription.dispose();
    });
  });

  describe('with cleanup function', () => {
    it('does not call for existing text editors that do not match the grammars', async () => {
      const textEditor = await atom.workspace.open();

      const fn: any = jest.fn();
      const cleanupFn: any = jest.fn();
      const subscription = observeLanguageTextEditors(
        grammarScopes,
        fn,
        cleanupFn,
      );

      expect(cleanupFn.mock.calls.length).toBe(0);

      subscription.dispose();
      textEditor.destroy();
    });

    it('does not call for new text editors that never matched the grammars', async () => {
      const fn: any = jest.fn();
      const cleanupFn: any = jest.fn();
      const subscription = observeLanguageTextEditors(
        grammarScopes,
        fn,
        cleanupFn,
      );

      const textEditor = await atom.workspace.open(tempFilenameJS);
      textEditor.setGrammar(nullGrammar);

      expect(cleanupFn.mock.calls.length).toBe(0);

      subscription.dispose();
      textEditor.destroy();
    });

    it('calls for new text editors that stop matching the grammars', async () => {
      const fn: any = jest.fn();
      const cleanupFn: any = jest.fn();
      const subscription = observeLanguageTextEditors(
        grammarScopes,
        fn,
        cleanupFn,
      );

      const textEditor = await atom.workspace.open(tempFilenameObjC);
      textEditor.setGrammar(nullGrammar);

      expect(cleanupFn).toHaveBeenCalledWith(textEditor);
      expect(cleanupFn.mock.calls.length).toBe(1);

      subscription.dispose();
      textEditor.destroy();
    });

    it('does not call when new text editors that do not match the grammars are destroyed', async () => {
      const fn: any = jest.fn();
      const cleanupFn: any = jest.fn();
      const subscription = observeLanguageTextEditors(
        grammarScopes,
        fn,
        cleanupFn,
      );

      const textEditor = await atom.workspace.open(tempFilenameJS);
      textEditor.destroy();

      expect(cleanupFn.mock.calls.length).toBe(0);

      subscription.dispose();
    });

    it('calls when new text editors matching the grammars are destroyed', async () => {
      const fn: any = jest.fn();
      const cleanupFn: any = jest.fn();
      const subscription = observeLanguageTextEditors(
        grammarScopes,
        fn,
        cleanupFn,
      );

      const textEditor = await atom.workspace.open(tempFilenameObjC);
      textEditor.destroy();

      expect(cleanupFn).toHaveBeenCalledWith(textEditor);
      expect(cleanupFn.mock.calls.length).toBe(1);

      subscription.dispose();
    });
  });
});
