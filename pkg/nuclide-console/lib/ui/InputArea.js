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

import React from 'react';
import ReactDOM from 'react-dom';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {Observable} from 'rxjs';

type Props = {
  onSubmit: (value: string) => mixed,
  scopeName: ?string,
  history: Array<string>,
};

type State = {
  historyIndex: number,
  draft: string,
};

const ENTER_KEY_CODE = 13;
const UP_KEY_CODE = 38;
const DOWN_KEY_CODE = 40;

export default class OutputTable extends React.Component {
  props: Props;
  state: State;

  _keySubscription: ?rxjs$ISubscription;
  _textEditorModel: ?atom$TextEditor;

  constructor(props: Props) {
    super(props);
    (this: any)._handleTextEditor = this._handleTextEditor.bind(this);
    (this: any)._handleKeyDown = this._handleKeyDown.bind(this);
    this.state = {
      historyIndex: -1,
      draft: '',
    };
  }

  _handleTextEditor(component: ?AtomTextEditor): void {
    if (this._keySubscription) {
      this._textEditorModel = null;
      this._keySubscription.unsubscribe();
    }
    if (component) {
      this._textEditorModel = component.getModel();
      const el = ReactDOM.findDOMNode(component);
      this._keySubscription = Observable.fromEvent(el, 'keydown').subscribe(
        this._handleKeyDown,
      );
    }
  }

  _handleKeyDown(event: KeyboardEvent): void {
    const editor = this._textEditorModel;
    if (editor == null) {
      return;
    }
    if (event.which === ENTER_KEY_CODE) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.ctrlKey) {
        editor.insertNewline();
        return;
      }

      // Clear the text and trigger the `onSubmit` callback
      const text = editor.getText();

      if (text === '') {
        return;
      }

      editor.setText(''); // Clear the text field.
      this.props.onSubmit(text);
      this.setState({historyIndex: -1});
    } else if (event.which === UP_KEY_CODE) {
      if (this.props.history.length === 0) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const historyIndex = Math.min(
        this.state.historyIndex + 1,
        this.props.history.length - 1,
      );
      if (this.state.historyIndex === -1) {
        this.setState({historyIndex, draft: editor.getText()});
      } else {
        this.setState({historyIndex});
      }
      editor.setText(
        this.props.history[this.props.history.length - historyIndex - 1],
      );
    } else if (event.which === DOWN_KEY_CODE) {
      if (this.props.history.length === 0) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const historyIndex = Math.max(this.state.historyIndex - 1, -1);
      this.setState({historyIndex});
      if (historyIndex === -1) {
        editor.setText(this.state.draft);
      } else {
        editor.setText(
          this.props.history[this.props.history.length - historyIndex - 1],
        );
      }
    }
  }

  render(): ?React.Element<any> {
    const grammar = this.props.scopeName == null
      ? null
      : atom.grammars.grammarForScopeName(this.props.scopeName);
    return (
      <div className="nuclide-console-input-wrapper">
        <AtomTextEditor
          ref={this._handleTextEditor}
          grammar={grammar}
          gutterHidden
          autoGrow
          lineNumberGutterVisible={false}
        />
      </div>
    );
  }
}
