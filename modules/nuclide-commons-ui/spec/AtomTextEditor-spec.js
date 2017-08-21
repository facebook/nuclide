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

import {AtomTextEditor} from '../AtomTextEditor';
import React from 'react';
import TestUtils from 'react-addons-test-utils';
import invariant from 'assert';

describe('nuclide-ui-atom-text-editor', () => {
  describe('when its `path` is set', () => {
    let grammar;

    beforeEach(() => {
      // Path is relative to the root of this package (where "package.json" lives).
      grammar = atom.grammars.loadGrammarSync('spec/grammars/test1.cson');
    });

    afterEach(() => {
      if (grammar) {
        atom.grammars.removeGrammarForScopeName(grammar.scopeName);
      }
    });

    it('loads the desired `Grammar`', () => {
      const element = TestUtils.renderIntoDocument(
        <AtomTextEditor path=".test" />,
      );
      expect(element.getModel().getGrammar().scopeName).toEqual('text.test');
    });
  });

  describe('providing a grammar', () => {
    let grammar1;
    let grammar2;

    beforeEach(() => {
      grammar1 = atom.grammars.loadGrammarSync('spec/grammars/test1.cson');
      grammar2 = atom.grammars.loadGrammarSync('spec/grammars/test2.cson');
    });

    afterEach(() => {
      invariant(grammar1 != null);
      atom.grammars.removeGrammarForScopeName(grammar1.scopeName);
      invariant(grammar2 != null);
      atom.grammars.removeGrammarForScopeName(grammar2.scopeName);
    });

    it('updates the underlying models grammar', () => {
      const element = TestUtils.renderIntoDocument(
        <AtomTextEditor path=".test" grammar={grammar2} />,
      );
      expect(element.getModel().getGrammar().scopeName).toEqual('text.test2');
    });
  });

  describe('when `readOnly`', () => {
    let element;

    describe('is true', () => {
      beforeEach(() => {
        element = TestUtils.renderIntoDocument(
          <AtomTextEditor readOnly={true} />,
        );
      });

      it('allows copying', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('fraggle');
        model.selectAll();
        model.copySelectedText();
        expect(atom.clipboard.read()).toEqual('fraggle');
      });

      it('disallows inserting', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('foobar');
        model.insertNewline();
        expect(model.getText()).toEqual('foobar');
      });

      it('disallows pasting', () => {
        invariant(element);
        const model = element.getModel();
        atom.clipboard.write('foo bar baz');
        model.pasteText();
        expect(model.getText()).toEqual('');
      });

      it('disallows deleting text', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('balloon');
        model.selectAll();
        model.delete();
        expect(model.getText()).toEqual('balloon');
      });

      it('disallows backspace', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('foobar');
        model.moveToEndOfLine();
        model.backspace();
        expect(model.getText()).toEqual('foobar');
      });
    });

    describe('is undefined', () => {
      beforeEach(() => {
        element = TestUtils.renderIntoDocument(<AtomTextEditor />);
      });

      it('allows copying', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('fraggle');
        model.selectAll();
        model.copySelectedText();
        expect(atom.clipboard.read()).toEqual('fraggle');
      });

      it('allows inserting', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('foobar');
        model.insertNewline();
        expect(model.getText()).toEqual('foobar\n');
      });

      it('allows pasting', () => {
        invariant(element);
        const model = element.getModel();
        atom.clipboard.write('foo bar baz');
        model.pasteText();
        expect(model.getText()).toEqual('foo bar baz');
      });

      it('allows deleting text', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('balloon');
        model.selectAll();
        model.delete();
        expect(model.getText()).toEqual('');
      });

      it('allows backspace', () => {
        invariant(element);
        const model = element.getModel();
        model.setText('foobar');
        model.moveToEndOfLine();
        model.backspace();
        expect(model.getText()).toEqual('fooba');
      });
    });
  });
});
