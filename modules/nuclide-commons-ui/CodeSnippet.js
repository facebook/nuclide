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

import {AtomInput} from './AtomInput';
import React from 'react';

type Props = {
  text: string,
  grammar?: atom$Grammar,
  highlights?: Array<atom$Range>,
  startLine: number,
  endLine: number,
  onClick: (event: SyntheticMouseEvent) => mixed,
  onLineClick: (event: SyntheticMouseEvent, line: number) => mixed,
};

export class CodeSnippet extends React.Component {
  props: Props;

  componentDidMount() {
    const editor = this.refs.editor.getTextEditor();
    const {grammar, highlights, startLine} = this.props;

    if (grammar) {
      editor.setGrammar(grammar);
    }

    if (highlights != null) {
      highlights.forEach(range => {
        const marker = editor.markBufferRange([
          [range.start.row - startLine, range.start.column],
          [range.end.row - startLine, range.end.column],
        ]);
        editor.decorateMarker(marker, {
          type: 'highlight',
          class: 'code-snippet-highlight',
        });
      });

      // Make sure at least one highlight is visible.
      if (highlights.length > 0) {
        editor.scrollToBufferPosition([
          highlights[0].end.row - startLine + 1,
          highlights[0].end.column,
        ]);
      }
    }
  }

  render(): React.Element<any> {
    const lineNumbers = [];
    for (let i = this.props.startLine; i <= this.props.endLine; i++) {
      lineNumbers.push(
        <div
          key={i}
          className="nuclide-ui-code-snippet-line-number"
          onClick={evt => this.props.onLineClick(evt, i)}>
          {i + 1}
        </div>,
      );
    }
    return (
      <div className="nuclide-ui-code-snippet">
        <div className="nuclide-ui-code-snippet-line-number-column">
          {lineNumbers}
        </div>
        <AtomInput
          ref="editor"
          initialValue={this.props.text}
          disabled={true}
          onClick={this.props.onClick}
        />
      </div>
    );
  }
}
