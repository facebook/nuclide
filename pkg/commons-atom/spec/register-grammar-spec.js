/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import nuclideUri from 'nuclide-commons/nuclideUri';
import registerGrammar from '../register-grammar';

describe('registerGrammar', () => {
  it('works', () => {
    waitsForPromise(async () => {
      atom.grammars.loadGrammarSync(
        nuclideUri.join(__dirname, 'grammars/javascript.cson'),
      );
      registerGrammar('source.js', ['cats']);
      const textEditor = await atom.workspace.open('file.cats');
      expect(textEditor.getGrammar().scopeName).toBe('source.js');
      textEditor.destroy();
    });
  });
});
