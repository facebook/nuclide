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
 */

/* global requestAnimationFrame */

import * as React from 'react';
import {Button} from './Button';
import {HighlightedCode} from './HighlightedCode';

class HighlightedCodeExample extends React.Component<{}, {|count: number|}> {
  state = {
    count: 1,
  };

  _addOneMore = () => {
    // TODO(pelmers): Use react deferred update API when facebook/react/issues/13306 is ready
    requestAnimationFrame(() => {
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.setState({count: this.state.count + 1});
    });
  };

  render(): React.Node {
    const jsGrammar = atom.grammars.grammarForScopeName('source.js');
    if (jsGrammar == null) {
      return null;
    }
    // Use our own source code as an example!
    const code = (HighlightedCodeExample.toString() + '\n').repeat(
      this.state.count,
    );
    // $FlowIgnore: Not an official API yet.
    const ConcurrentMode = React.unstable_ConcurrentMode;
    return (
      <div>
        The code below is rendered with async React, so highlighting does not
        block (no matter how many lines have to be tokenized).
        <br />
        <Button onClick={this._addOneMore}>Add more code!</Button>
        <ConcurrentMode>
          <HighlightedCode
            grammar={jsGrammar}
            code={code}
            style={{marginTop: '8px'}}
          />
        </ConcurrentMode>
      </div>
    );
  }
}

export const HighlightedCodeExamples = {
  sectionName: 'HighlightedCode',
  description:
    'HighlightedCode provides a lighter-weight syntax highlighter for code.\n' +
    'It uses the same tokenizer as Atom text editors but ditches the editor.',
  examples: [
    {
      title: 'HighlightedCode',
      component: HighlightedCodeExample,
    },
  ],
};
