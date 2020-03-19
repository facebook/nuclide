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
import {sleep} from 'nuclide-commons/promise';
import {AtomTextEditor} from '../AtomTextEditor';
import * as React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import invariant from 'assert';
import path from 'path';

describe('nuclide-ui-atom-text-editor', () => {
  describe('when its `path` is set', () => {
    let grammar;

    beforeEach(() => {
      // Path is relative to the root of this package (where "package.json" lives).
      grammar = atom.grammars.loadGrammarSync(
        path.resolve(__dirname, '../__mocks__/grammars/test1.cson'),
      );
    });

    afterEach(() => {
      if (grammar) {
        atom.grammars.removeGrammarForScopeName(grammar.scopeName);
      }
    });

    it('loads the desired `Grammar`', () => {
      // $FlowIgnore
      const element: AtomTextEditor = TestUtils.renderIntoDocument(
        <AtomTextEditor path=".test" />,
      );
      expect(element.getModel().getGrammar().scopeName).toEqual('text.test');
    });
  });

  describe('providing a grammar', () => {
    let grammar1;
    let grammar2;

    beforeEach(() => {
      grammar1 = atom.grammars.loadGrammarSync(
        path.resolve(__dirname, '../__mocks__/grammars/test1.cson'),
      );
      grammar2 = atom.grammars.loadGrammarSync(
        path.resolve(__dirname, '../__mocks__/grammars/test2.cson'),
      );
    });

    afterEach(() => {
      invariant(grammar1 != null);
      atom.grammars.removeGrammarForScopeName(grammar1.scopeName);
      invariant(grammar2 != null);
      atom.grammars.removeGrammarForScopeName(grammar2.scopeName);
    });

    it('updates the underlying models grammar', () => {
      // $FlowIgnore
      const element: AtomTextEditor = TestUtils.renderIntoDocument(
        <AtomTextEditor path=".test" grammar={grammar2} />,
      );
      expect(element.getModel().getGrammar().scopeName).toEqual('text.test2');
    });
  });

  it('does not leak TextEditorComponent', async () => {
    const hostEl = document.createElement('div');
    const component = ReactDOM.render(<AtomTextEditor />, hostEl);
    const textEditor = component.getModel();
    const element = textEditor.getElement();
    ReactDOM.unmountComponentAtNode(hostEl);

    // Cleanup occurs during the next tick.
    await sleep(0);
    expect(element.component).toBe(null);
  });
});
