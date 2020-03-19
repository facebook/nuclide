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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {Observable} from 'rxjs';

type Props = {|
  fontSize: number,
  onSubmit: (value: string) => mixed,
  scopeName: ?string,
  history: Array<string>,
  watchEditor: ?atom$AutocompleteWatchEditor,
  onDidTextBufferChange?: (event: atom$AggregatedTextEditEvent) => mixed,
  placeholderText?: string,
|};

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

  focus = (): void => {
    if (this._textEditorModel != null) {
      this._textEditorModel.getElement().focus();
    }
  };

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
      // If the current auto complete settings are such that pressing
      // enter does NOT accept a suggestion, and the auto complete box
      // is open, treat enter as submit. Otherwise, let the event
      // propagate so that autocomplete can handle it.
      const setting = atom.config.get('autocomplete-plus.confirmCompletion');
      const enterAcceptsSuggestion =
        setting == null || String(setting).includes('enter');
      if (!isAutocompleteOpen || !enterAcceptsSuggestion) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (event.ctrlKey || event.altKey || event.shiftKey) {
          editor.insertNewline();
          return;
        }

        this._submit();
      }
    } else if (
      event.which === UP_KEY_CODE &&
      (editor.getLineCount() <= 1 || editor.getCursorBufferPosition().row === 0)
    ) {
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
    } else if (
      event.which === DOWN_KEY_CODE &&
      (editor.getLineCount() <= 1 ||
        editor.getCursorBufferPosition().row === editor.getLineCount() - 1)
    ) {
      if (this.props.history.length === 0 || isAutocompleteOpen) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
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
      <div
        className="console-input-wrapper"
        style={{fontSize: `${this.props.fontSize}px`}}>
        <AtomTextEditor
          ref={this._handleTextEditor}
          grammar={grammar}
          gutterHidden
          autoGrow
          lineNumberGutterVisible={false}
          onConfirm={this._submit}
          onInitialized={this._attachLabel}
          onDidTextBufferChange={this.props.onDidTextBufferChange}
          placeholderText={this.props.placeholderText}
        />
      </div>
    );
  }
}
