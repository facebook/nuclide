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

import type {WatchEditorFunction} from '../types';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {Observable} from 'rxjs';

type Props = {
  onSubmit: (value: string) => mixed,
  scopeName: ?string,
  history: Array<string>,
  watchEditor: ?WatchEditorFunction,
};

type State = {
  historyIndex: number,
  draft: string,
};

const ENTER_KEY_CODE = 13;
const UP_KEY_CODE = 38;
const DOWN_KEY_CODE = 40;

export default class InputArea extends React.Component<Props, State> {
  _keySubscription: ?rxjs$ISubscription;
  _textEditorModel: ?atom$TextEditor;

  constructor(props: Props) {
    super(props);
    this.state = {
      historyIndex: -1,
      draft: '',
    };
  }

  _submit = (): void => {
    // Clear the text and trigger the `onSubmit` callback
    const editor = this._textEditorModel;
    if (editor == null) {
      return;
    }

    const text = editor.getText();
    if (text === '') {
      return;
    }

    editor.setText(''); // Clear the text field.
    this.props.onSubmit(text);
    this.setState({historyIndex: -1});
  };

  _attachLabel = (editor: atom$TextEditor): IDisposable => {
    const {watchEditor} = this.props;
    const disposable = new UniversalDisposable();
    if (watchEditor) {
      disposable.add(watchEditor(editor, ['nuclide-console']));
    }
    return disposable;
  };

  _handleTextEditor = (component: ?AtomTextEditor): void => {
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
  };

  _handleKeyDown = (event: KeyboardEvent): void => {
    const editor = this._textEditorModel;
    // Detect AutocompletePlus menu element: https://git.io/vddLi
    const isAutocompleteOpen =
      document.querySelector('autocomplete-suggestion-list') != null;
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

      this._submit();
    } else if (event.which === UP_KEY_CODE) {
      if (this.props.history.length === 0 || isAutocompleteOpen) {
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
      if (this.props.history.length === 0 || isAutocompleteOpen) {
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
  };

  render(): React.Node {
    const grammar =
      this.props.scopeName == null
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
          onConfirm={this._submit}
          onInitialized={this._attachLabel}
        />
      </div>
    );
  }
}
