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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import React from 'react';
import ReactDOM from 'react-dom';

import nuclideUri from 'nuclide-commons/nuclideUri';

type Options = {[key: string]: boolean};

type AdditionalOptions = {
  [key: string]: string,
};

type Props = {
  // Extra options to show the user.
  additionalOptions?: AdditionalOptions,
  iconClassName?: string,
  initialValue?: string,
  // Message is displayed above the input.
  message: React.Element<any>,
  // Will be called (before `onClose`) if the user confirms.
  onConfirm: (value: boolean, options: Options) => void,
  // Will be called regardless of whether the user confirms.
  onClose: () => void,
  // Whether or not to initially select the base name of the path.
  // This is useful for renaming files.
  selectBasename?: boolean,
};

/**
 * Component that displays UI to create a new file.
 */
export default class FileDialogComponent extends React.Component {
  _disposables: UniversalDisposable;
  _isClosed: boolean;

  props: Props;

  static defaultProps: {
    additionalOptions: AdditionalOptions,
  } = {
    additionalOptions: {},
  };

  state: {
    options: Options,
  };

  constructor(props: Props) {
    super(props);
    this._isClosed = false;
    this._disposables = new UniversalDisposable();
    (this: any)._close = this._close.bind(this);
    (this: any)._confirm = this._confirm.bind(this);
    (this: any)._handleDocumentMouseDown = this._handleDocumentMouseDown.bind(
      this,
    );
    const options = {};
    for (const name in this.props.additionalOptions) {
      options[name] = true;
    }
    this.state = {
      options,
    };
  }

  componentDidMount(): void {
    const input = this.refs.input;
    this._disposables.add(
      atom.commands.add(
        // $FlowFixMe
        ReactDOM.findDOMNode(input),
        {
          'core:confirm': this._confirm,
          'core:cancel': this._close,
        },
      ),
    );
    const path = this.props.initialValue;
    input.focus();
    if (this.props.selectBasename && path != null) {
      const {dir, name} = nuclideUri.parsePath(path);
      const selectionStart = dir ? dir.length + 1 : 0;
      const selectionEnd = selectionStart + name.length;
      input
        .getTextEditor()
        .setSelectedBufferRange([[0, selectionStart], [0, selectionEnd]]);
    }
    document.addEventListener('mousedown', this._handleDocumentMouseDown);
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
    document.removeEventListener('mousedown', this._handleDocumentMouseDown);
  }

  render(): React.Element<any> {
    let labelClassName;
    if (this.props.iconClassName != null) {
      labelClassName = `icon ${this.props.iconClassName}`;
    }

    const checkboxes = [];
    for (const name in this.props.additionalOptions) {
      const message = this.props.additionalOptions[name];
      const checked = this.state.options[name];
      const checkbox = (
        <Checkbox
          key={name}
          checked={checked}
          onChange={this._handleAdditionalOptionChanged.bind(this, name)}
          label={message}
        />
      );
      checkboxes.push(checkbox);
    }

    // `.tree-view-dialog` is unstyled but is added by Atom's tree-view package[1] and is styled by
    // 3rd-party themes. Add it to make this package's modals styleable the same as Atom's
    // tree-view.
    //
    // [1] https://github.com/atom/tree-view/blob/v0.200.0/lib/dialog.coffee#L7
    return (
      <div className="tree-view-dialog" ref="dialog">
        <label className={labelClassName}>{this.props.message}</label>
        <AtomInput initialValue={this.props.initialValue} ref="input" />
        {checkboxes}
      </div>
    );
  }

  _handleAdditionalOptionChanged(name: string, isChecked: boolean): void {
    const {options} = this.state;
    options[name] = isChecked;
    this.setState({options});
  }

  _handleDocumentMouseDown(event: Event): void {
    const dialog = this.refs.dialog;
    // If the click did not happen on the dialog or on any of its descendants,
    // the click was elsewhere on the document and should close the modal.
    if (event.target !== dialog && !dialog.contains(event.target)) {
      this._close();
    }
  }

  _confirm() {
    this.props.onConfirm(this.refs.input.getText(), this.state.options);
    this._close();
  }

  _close() {
    if (!this._isClosed) {
      this._isClosed = true;
      this.props.onClose();
    }
  }
}
