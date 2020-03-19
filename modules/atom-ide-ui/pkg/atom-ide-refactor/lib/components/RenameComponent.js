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

import type {RefactorProvider, RenameRequest, Store} from '../types';

import * as React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import * as Actions from '../refactorActions';

export type Props = {
  selectedText: string,
  providers: RefactorProvider[],
  parentEditor: atom$TextEditor,
  store: Store,
  symbolPosition: atom$Point,
};

type State = {
  newName: string,
};

export default class RenameComponent extends React.Component<Props, State> {
  _atomInput: ?AtomInput;

  constructor(props: Props) {
    super(props);

    this.state = {
      newName: this.props.selectedText,
    };
  }

  componentDidMount() {
    this._forceActivateInsertMode();
    this._highlightTextWithin();
  }

  // When using the `vim-mode-plus` package, the user has to press 'i' in 'normal-mode'
  //  to begin inserting text in an atom-text-editor - doing so sends
  //  an 'activate-insert-mode' command.
  // However, when the user wants to type in embedded text editors,
  //  we must first activate `insert-mode` in the parent editor.
  _forceActivateInsertMode = (): void => {
    const {parentEditor} = this.props;

    if (parentEditor != null) {
      atom.commands.dispatch(
        atom.views.getView(parentEditor),
        'vim-mode-plus:activate-insert-mode',
      );
    }
  };

  _highlightTextWithin = (): void => {
    if (this._atomInput == null) {
      return;
    }
    const editor = this._atomInput.getTextEditor();
    editor.selectAll();
  };

  _handleSubmit = (event: ?Event): void => {
    if (event == null) {
      return;
    }
    const {newName} = this.state;
    const {store} = this.props;

    const renameRequest: RenameRequest = {
      kind: 'rename',
      newName,
      editor: this.props.parentEditor,
      position: this.props.symbolPosition,
    };

    return newName === ''
      ? store.dispatch(Actions.close())
      : store.dispatch(Actions.execute(this.props.providers, renameRequest));
  };

  _handleCancel = (event: ?Event): void => {
    if (event == null) {
      return;
    }

    this.props.store.dispatch(Actions.close());
  };

  _handleChange = (text: string): void => {
    this.setState({newName: text});
  };

  _handleBlur = (event: Event): void => {
    this.props.store.dispatch(Actions.close());
  };

  render(): React.Node {
    // TODO: Adjust width automatically through property within AtomInput/AtomTextEditor
    //       AtomTextEditor's autoWidth doesn't work here when enabled through AtomInput.
    //       This is a hacky solution for now for the sake of decent UX.
    const widthStyle = {
      minWidth: '110px',
      width: `${this.state.newName.length * 0.675}em`,
      maxWidth: '350px',
    };

    return (
      <AtomInput
        ref={atomInput => (this._atomInput = atomInput)}
        style={widthStyle}
        autofocus={true}
        value={this.state.newName}
        onDidChange={this._handleChange}
        onBlur={this._handleBlur}
        onConfirm={this._handleSubmit}
        onCancel={this._handleCancel}
      />
    );
  }
}
