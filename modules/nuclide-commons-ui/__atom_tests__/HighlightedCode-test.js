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
import dedent from 'dedent';
import nullthrows from 'nullthrows';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {
  highlightCode,
  highlightCodeHtml,
  HighlightedCode,
} from '../HighlightedCode';

describe('highlightCode', () => {
  let grammar: atom$Grammar;
  beforeEach(async () => {
    await atom.packages.activatePackage('language-gfm');
    grammar = nullthrows(atom.grammars.grammarForScopeName('source.gfm'));
  });

  it('is able to tokenize lines using a grammar', () => {
    const tokens = highlightCode(
      grammar,
      dedent`
        #Heading
        __bold__
        *italic*
      `,
    );
    // Desperately needs Jest snapshots!
    expect(tokens).toEqual([
      [
        {type: 'start', className: 'syntax--source syntax--gfm'},
        {
          type: 'start',
          className:
            'syntax--markup syntax--heading syntax--heading-1 syntax--gfm',
        },
        {
          type: 'start',
          className:
            'syntax--markup syntax--heading syntax--marker syntax--gfm',
        },
        {type: 'value', value: '#'},
        {type: 'end'},
        {type: 'value', value: 'Heading'},
        {type: 'end'},
        {type: 'end'},
      ],
      [
        {type: 'start', className: 'syntax--source syntax--gfm'},
        {type: 'start', className: 'syntax--markup syntax--bold syntax--gfm'},
        {type: 'value', value: '__'},
        {type: 'value', value: 'bold'},
        {type: 'value', value: '__'},
        {type: 'end'},
        {type: 'end'},
      ],
      [
        {type: 'start', className: 'syntax--source syntax--gfm'},
        {type: 'start', className: 'syntax--markup syntax--italic syntax--gfm'},
        {type: 'value', value: '*'},
        {type: 'value', value: 'italic'},
        {type: 'value', value: '*'},
        {type: 'end'},
        {type: 'end'},
      ],
    ]);
  });

  it('becomes HTML using highlightCodeHtml', () => {
    const EXPECTED = `
      <span class="syntax--source syntax--gfm">
        <span class="syntax--markup syntax--heading syntax--heading-1 syntax--gfm">
          <span class="syntax--markup syntax--heading syntax--marker syntax--gfm">
            #
          </span>
          Heading
        </span>
      </span>
    `.replace(/\s+/g, '');

    const html = highlightCodeHtml(grammar, '#Heading');
    expect(html.replace(/\s+/g, '')).toBe(EXPECTED);

    const node = document.createElement('div');
    ReactDOM.render(
      <HighlightedCode grammar={grammar} code="#Heading" />,
      node,
    );

    expect(node.innerHTML.replace(/\s+/g, '')).toContain(EXPECTED);
  });

  it('escapes HTML in HTML', () => {
    const EXPECTED = `
      <span class="syntax--source syntax--gfm">
        &lt;&gt;
      </span>
    `.replace(/\s+/g, '');

    const html = highlightCodeHtml(grammar, '<>');
    expect(html.replace(/\s+/g, '')).toBe(EXPECTED);
  });
});
