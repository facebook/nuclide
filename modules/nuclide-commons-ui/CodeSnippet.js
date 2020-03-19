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

import {AtomInput} from './AtomInput';
import invariant from 'assert';
import * as React from 'react';

type Props = {
  text: string,
  grammar?: atom$Grammar,
  highlights?: Array<atom$Range>, // NB: Highlights require a start/end line
  startLine: ?number,
  endLine: ?number,
  onClick: (event: SyntheticMouseEvent<>) => mixed,
  onLineClick: (event: SyntheticMouseEvent<>, line: number) => mixed,
  onDidChange?: string => mixed,
};

export class CodeSnippet extends React.Component<Props> {
  _editor: ?AtomInput;
  _ongoingSelection: ?atom$Selection;

  componentDidMount() {
    invariant(this._editor != null);
    const editor = this._editor.getTextEditor();
    const {grammar, highlights, startLine} = this.props;

    if (grammar) {
      editor.setGrammar(grammar);
    }

    if (highlights != null) {
      invariant(startLine != null);

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

  render(): React.Node {
    const lineNumbers = [];
    let lineNumberColumn: ?React.Node;

    if (this.props.startLine != null && this.props.endLine != null) {
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

      lineNumberColumn = (
        <div className="nuclide-ui-code-snippet-line-number-column">
          {lineNumbers}
        </div>
      );
    }

    return (
      <div className="nuclide-ui-code-snippet">
        {lineNumberColumn}
        <AtomInput
          ref={input => {
            this._editor = input;
          }}
          initialValue={this.props.text}
          onMouseDown={e => {
            this._ongoingSelection = null;
          }}
          onDidChangeSelectionRange={e => {
            this._ongoingSelection = e.selection;
          }}
          onDidChange={this.props.onDidChange}
          onClick={e => {
            // If the user selected a range, cancel the `onClick` behavior
            // to enable copying the selection.
            let shouldCancel = false;
            if (this._ongoingSelection != null) {
              const {start, end} = this._ongoingSelection.getBufferRange();
              shouldCancel = start.compare(end) !== 0;
            }
            if (!shouldCancel) {
              this.props.onClick(e);
            }
            this._ongoingSelection = null;
          }}
        />
      </div>
    );
  }
}
