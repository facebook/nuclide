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

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import invariant from 'assert';
import classnames from 'classnames';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {fastDebounce} from 'nuclide-commons/observable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {|
  atomInput: AtomInput,
  displayOnFocus: boolean,
  errorMessage: ?string,
  isLoading: boolean,
  loadingMessage: string,
  onSelect?: (option: string) => void,
  options: Array<string>,
|};

type State = {|
  optionsVisible: boolean,
  optionsRect: ?{
    top: number,
    left: number,
    width: number,
  },
  selectedIndex: number,
|};

const UP = -1;
const DOWN = 1;

/**
 * A dumb component that just takes a list of dropdown results, and renders
 * a rect beneath a given AtomInput ref. Default onSelect of an item will
 * populate the AtomInput, but it can be overriden to do anything else.
 */
export default class DropdownResults extends React.Component<Props, State> {
  state = {
    optionsVisible: false,
    optionsRect: null,
    selectedIndex: -1,
  };

  static defaultProps = {
    displayOnFocus: false,
    errorMessage: null,
    isLoading: false,
    loadingMessage: 'Loading Results',
  };

  _disposables: UniversalDisposable;
  _optionsElement: HTMLElement;

  _shouldShowOnFocus: boolean;
  _shouldShowOnChange: boolean;
  _keepFocus: boolean;

  constructor(props: Props) {
    super(props);

    const workspaceElement = atom.views.getView(atom.workspace);
    invariant(workspaceElement != null);

    this._optionsElement = document.createElement('div');
    workspaceElement.appendChild(this._optionsElement);

    this._shouldShowOnChange = true;
    this._shouldShowOnFocus = true;
    this._keepFocus = false;
  }

  componentDidMount(): void {
    const editorElement = this.props.atomInput.getTextEditorElement();
    const editor = this.props.atomInput.getTextEditor();

    this._disposables = new UniversalDisposable(
      () => {
        this._optionsElement.remove();
      },
      Observable.fromEvent(window, 'resize')
        .let(fastDebounce(200))
        .subscribe(this._recalculateRect),
      Observable.fromEvent(editorElement, 'focus').subscribe(
        this._handleInputFocus,
      ),
      Observable.fromEvent(editorElement, 'blur').subscribe(
        this._handleInputBlur,
      ),
      atom.commands.add(editorElement, 'core:move-up', () =>
        this._handleMove(UP),
      ),
      atom.commands.add(editorElement, 'core:move-down', () =>
        this._handleMove(DOWN),
      ),
      Observable.fromEvent(editorElement, 'keydown').subscribe(
        this._handleConfirm,
      ),
      observableFromSubscribeFunction(
        editor.onDidChange.bind(editor),
      ).subscribe(this._handleInputChange),
    );

    this._recalculateRect();
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  render(): React.Node {
    if (!this.state.optionsVisible) {
      return null;
    }

    let options = [];
    if (this.props.errorMessage != null && this.props.errorMessage.length > 0) {
      options.push(
        <li key="error-text" className="error">
          <span className="error-message">{this.props.errorMessage}</span>
        </li>,
      );
    } else if (this.props.isLoading) {
      options.push(
        <li key="loading-text" className="loading">
          <span className="loading-message">{this.props.loadingMessage}</span>
        </li>,
      );
    } else {
      options = this.props.options.map((option, i) => (
        <li
          key={'option-' + option}
          className={classnames({
            selected: i === this.state.selectedIndex,
            'nuclide-dropdown-result': true,
          })}
          onMouseDown={() => this._onSelect(option)}
          onMouseOver={() => this._setSelectedIndex(i)}>
          {option}
        </li>
      ));
    }

    return ReactDOM.createPortal(
      <div
        className="nuclide-combobox-options nuclide-dropdown-results"
        style={this.state.optionsRect}>
        <div className="select-list">
          <ol className="nuclide-combobox-list-group list-group">{options}</ol>
        </div>
      </div>,
      this._optionsElement,
    );
  }

  _onSelect = (option: string, fromConfirm: boolean = false) => {
    this._shouldShowOnChange = false;

    this.setState({
      optionsVisible: false,
      selectedIndex: -1,
    });

    if (this.props.onSelect != null) {
      this.props.onSelect(option);
    } else {
      this.props.atomInput.setText(option);
    }

    // Re-focusing only needs to happen when mouse clicking results.
    if (!fromConfirm) {
      this._keepFocus = true;
      this._shouldShowOnFocus = false;
    }
  };

  _setSelectedIndex = (selectedIndex: number) => {
    this.setState({selectedIndex});
  };

  _recalculateRect = () => {
    const boundingRect = this.props.atomInput
      .getTextEditorElement()
      .getBoundingClientRect();
    this.setState({
      optionsRect: {
        top: boundingRect.bottom,
        left: boundingRect.left,
        width: boundingRect.width,
      },
    });
  };

  _handleInputFocus = (): void => {
    // When an option is selected, the input gets focused again, but we don't
    // want to show dropdown results again.
    if (!this._shouldShowOnFocus) {
      this._shouldShowOnFocus = true;
    } else if (this.props.displayOnFocus) {
      this.setState({
        optionsVisible: true,
      });
    }
  };

  _handleInputChange = (): void => {
    // When an option is selected, the input will trigger this, but we don't
    // want to show dropdown results again.
    if (!this._shouldShowOnChange) {
      this._shouldShowOnChange = true;
    } else if (this.props.atomInput.isFocused() && !this.state.optionsVisible) {
      this.setState({
        optionsVisible: true,
      });
    }
  };

  _handleInputBlur = (): void => {
    // When an option is selected from a mouse click, we want to keep the focus
    // on the atom input.
    if (this._keepFocus) {
      this.props.atomInput.focus();
      this._keepFocus = false;
    } else {
      this._handleCancel();
    }
  };

  _handleCancel = (): void => {
    this.setState({
      optionsVisible: false,
    });
  };

  _handleMove = (increment: number): void => {
    if (!this.state.optionsVisible) {
      this.setState({
        optionsVisible: true,
      });
    } else {
      // Moves selected index up or down with wrapping.
      // Also, add one entry for nothing selected (default dropdown behavior).
      const optionsSize = this.props.options.length + 1;
      this.setState({
        selectedIndex:
          // TODO: (wbinnssmith) T30771435 this setState depends on current state
          // and should use an updater function rather than an object
          // eslint-disable-next-line react/no-access-state-in-setstate
          ((this.state.selectedIndex + increment + optionsSize + 1) %
            optionsSize) -
          1,
      });
    }
  };

  _handleConfirm = (event: SyntheticKeyboardEvent<>): void => {
    if (this.state.optionsVisible) {
      if (event.key === 'Enter' && this.state.selectedIndex >= 0) {
        this._onSelect(
          this.props.options[this.state.selectedIndex],
          true /* fromConfirm */,
        );
        event.stopPropagation();
      } else if (event.key === 'Escape') {
        this._handleCancel();
        event.stopPropagation();
      }
    }
  };
}
