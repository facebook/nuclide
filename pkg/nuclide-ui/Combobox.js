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

/* globals Element */

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Portal} from './Portal';
import React from 'react';
import ReactDOM from 'react-dom';
import {scrollIntoViewIfNeeded} from 'nuclide-commons-ui/scrollIntoView';

type DefaultProps = {
  className: string,
  maxOptionCount: number,
  onChange: (newValue: string) => mixed,
  onSelect: (newValue: string) => mixed,
  width: ?number,
  disabled: boolean,
};

type Props = DefaultProps & {
  formatRequestOptionsErrorMessage?: (error: Error) => string,
  initialTextInput: string,
  loadingMessage?: string,
  placeholderText?: string,
  onRequestOptionsError?: (error: Error) => void,
  onBlur?: (text: string) => void,
  filterOptions?: (
    options: Array<string>,
    filterValue: string,
  ) => Array<string>,
  requestOptions: (inputText: string) => Observable<Array<string>>,
  size: 'xs' | 'sm' | 'lg',
  disabled: boolean,
};

type State = {
  error: ?Error,
  filteredOptions: Array<string>,
  loadingOptions: boolean,
  options: Array<string>,
  optionsVisible: boolean,
  optionsRect: ?{
    top: number,
    left: number,
    width: number,
  },
  selectedIndex: number,
  textInput: string,
};

/**
 * A Combo Box.
 * TODO allow making text input non-editable via props
 * TODO open/close options dropdown upon focus/blur
 * TODO add public getter/setter for textInput
 * TODO use generic search provider
 * TODO move combobox to separate package.
 */
export class Combobox extends React.Component {
  props: Props;
  state: State;

  _optionsElement: HTMLElement;
  _updateSubscription: ?rxjs$ISubscription;
  _subscriptions: UniversalDisposable;

  static defaultProps: DefaultProps = {
    className: '',
    maxOptionCount: 10,
    onChange: (newValue: string) => {},
    onSelect: (newValue: string) => {},
    width: 200,
    disabled: false,
  };

  constructor(props: Props) {
    super(props);
    this._subscriptions = new UniversalDisposable();
    this.state = {
      error: null,
      filteredOptions: [],
      loadingOptions: false,
      options: [],
      optionsRect: null,
      optionsVisible: false,
      selectedIndex: -1,
      textInput: props.initialTextInput,
    };
  }

  componentDidMount() {
    const node = ReactDOM.findDOMNode(this);
    this._subscriptions.add(
      // $FlowFixMe
      atom.commands.add(node, 'core:move-up', this._handleMoveUp),
      // $FlowFixMe
      atom.commands.add(node, 'core:move-down', this._handleMoveDown),
      // $FlowFixMe
      atom.commands.add(node, 'core:cancel', this._handleCancel),
      // $FlowFixMe
      atom.commands.add(node, 'core:confirm', this._handleConfirm),
      this.refs.freeformInput.onDidChange(this._handleTextInputChange),
    );
  }

  componentWillUnmount() {
    if (this._subscriptions) {
      this._subscriptions.dispose();
    }
    if (this._updateSubscription != null) {
      this._updateSubscription.unsubscribe();
    }
  }

  requestUpdate(textInput: string): void {
    // Cancel pending update.
    if (this._updateSubscription != null) {
      this._updateSubscription.unsubscribe();
    }

    this.setState({error: null, loadingOptions: true});

    this._updateSubscription = this.props.requestOptions(textInput).subscribe(
      options => this.receiveUpdate(options),
      err => {
        this.setState({
          error: err,
          loadingOptions: false,
          options: [],
          filteredOptions: [],
        });
        if (this.props.onRequestOptionsError != null) {
          this.props.onRequestOptionsError(err);
        }
      },
      () => this.setState({loadingOptions: false}),
    );
  }

  receiveUpdate = (newOptions: Array<string>) => {
    const filteredOptions = this._getFilteredOptions(
      newOptions,
      this.state.textInput,
    );
    this.setState({
      error: null,
      options: newOptions,
      filteredOptions,
      selectedIndex: this._getNewSelectedIndex(filteredOptions),
    });
  };

  selectValue(newValue: string, didRenderCallback?: () => void) {
    this.refs.freeformInput.setText(newValue);
    this.setState(
      {
        textInput: newValue,
        selectedIndex: -1,
        optionsVisible: false,
      },
      didRenderCallback,
    );
    this.props.onSelect(newValue);
    // Selecting a value in the dropdown changes the text as well. Call the callback accordingly.
    this.props.onChange(newValue);
  }

  getText(): string {
    return this.refs.freeformInput.getText();
  }

  focus(showOptions: boolean): void {
    this.refs.freeformInput.focus();
    this.setState({optionsVisible: showOptions});
  }

  _getFilteredOptions(
    options: Array<string>,
    filterValue: string,
  ): Array<string> {
    if (this.props.filterOptions != null) {
      return this.props
        .filterOptions(options, filterValue)
        .slice(0, this.props.maxOptionCount);
    }

    const lowerCaseState = filterValue.toLowerCase();
    return options
      .map(option => {
        const valueLowercase = option.toLowerCase();
        return {
          value: option,
          matchIndex: valueLowercase.indexOf(lowerCaseState),
        };
      })
      .filter(option => option.matchIndex !== -1)
      .sort((a, b) => {
        // We prefer lower match indices
        const indexDiff = a.matchIndex - b.matchIndex;
        if (indexDiff !== 0) {
          return indexDiff;
        }
        // Then we prefer smaller options, thus close to the input
        return a.value.length - b.value.length;
      })
      .map(option => option.value)
      .slice(0, this.props.maxOptionCount);
  }

  _getOptionsElement(): HTMLElement {
    if (this._optionsElement == null) {
      const workspaceElement = atom.views.getView(atom.workspace);
      invariant(workspaceElement != null);

      this._optionsElement = document.createElement('div');
      workspaceElement.appendChild(this._optionsElement);
      this._subscriptions.add(() => {
        this._optionsElement.remove();
      });
    }
    return this._optionsElement;
  }

  _getNewSelectedIndex(filteredOptions: Array<string>): number {
    if (filteredOptions.length === 0) {
      // If there aren't any options, don't select anything.
      return -1;
    } else if (
      this.state.selectedIndex === -1 ||
      this.state.selectedIndex >= filteredOptions.length
    ) {
      // If there are options and the selected index is out of bounds,
      // default to the first item.
      return 0;
    }
    return this.state.selectedIndex;
  }

  _handleTextInputChange = (): void => {
    const newText = this.refs.freeformInput.getText();
    if (newText === this.state.textInput) {
      return;
    }
    this.requestUpdate(newText);
    const filteredOptions = this._getFilteredOptions(
      this.state.options,
      newText,
    );
    this.setState({
      textInput: newText,
      optionsVisible: true,
      filteredOptions,
      selectedIndex: this._getNewSelectedIndex(filteredOptions),
    });
    this.props.onChange(newText);
  };

  _handleInputFocus = (): void => {
    this.requestUpdate(this.state.textInput);
    // $FlowFixMe
    const boundingRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
    this.setState({
      optionsVisible: true,
      optionsRect: {
        top: boundingRect.bottom,
        left: boundingRect.left,
        width: boundingRect.width,
      },
    });
  };

  _handleInputBlur = (event: Object): void => {
    const {relatedTarget} = event;
    if (
      relatedTarget == null ||
      // TODO(hansonw): Move this check inside AtomInput.
      // See https://github.com/atom/atom/blob/master/src/text-editor-element.coffee#L145
      (relatedTarget.tagName === 'INPUT' &&
        relatedTarget.classList.contains('hidden-input')) ||
      // Selecting a menu item registers on the portal container.
      relatedTarget === this._getOptionsElement().parentNode
    ) {
      return;
    }
    this._handleCancel();
    const {onBlur} = this.props;
    if (onBlur != null) {
      onBlur(this.getText());
    }
  };

  _handleInputClick = (): void => {
    this.setState({optionsVisible: true});
  };

  _handleItemClick(selectedValue: string, event: any) {
    this.selectValue(selectedValue, () => {
      // Focus the input again because the click will cause the input to blur. This mimics native
      // <select> behavior by keeping focus in the form being edited.
      const input = ReactDOM.findDOMNode(this.refs.freeformInput);
      if (input) {
        // $FlowFixMe
        input.focus();
        // Focusing usually shows the options, so hide them immediately.
        setImmediate(() => this.setState({optionsVisible: false}));
      }
    });
  }

  _handleMoveDown = () => {
    // show the options but don't move the index
    if (!this.state.optionsVisible) {
      this.setState(
        {optionsVisible: true},
        this._scrollSelectedOptionIntoViewIfNeeded,
      );
      return;
    }

    this.setState(
      {
        selectedIndex: Math.min(
          this.props.maxOptionCount - 1,
          this.state.selectedIndex + 1,
          this.state.filteredOptions.length - 1,
        ),
      },
      this._scrollSelectedOptionIntoViewIfNeeded,
    );
  };

  _handleMoveUp = () => {
    this.setState(
      {
        selectedIndex: Math.max(0, this.state.selectedIndex - 1),
      },
      this._scrollSelectedOptionIntoViewIfNeeded,
    );
  };

  _handleCancel = () => {
    this.setState({
      optionsVisible: false,
    });
  };

  _handleConfirm = () => {
    const option = this.state.filteredOptions[this.state.selectedIndex];
    if (option !== undefined) {
      this.selectValue(option);
    }
  };

  _setSelectedIndex(selectedIndex: number) {
    this.setState({selectedIndex});
  }

  _scrollSelectedOptionIntoViewIfNeeded = (): void => {
    const selectedOption = ReactDOM.findDOMNode(this.refs.selectedOption);
    if (selectedOption instanceof Element) {
      scrollIntoViewIfNeeded(selectedOption);
    }
  };

  render(): React.Element<any> {
    let optionsContainer;
    const options = [];

    // flowlint-next-line sketchy-null-string:off
    if (this.props.loadingMessage && this.state.loadingOptions) {
      options.push(
        <li key="loading-text" className="loading">
          <span className="loading-message">
            {this.props.loadingMessage}
          </span>
        </li>,
      );
    }

    if (
      this.state.error != null &&
      this.props.formatRequestOptionsErrorMessage != null
    ) {
      const message = this.props.formatRequestOptionsErrorMessage(
        this.state.error,
      );
      options.push(
        <li key="text-error" className="text-error">
          {message}
        </li>,
      );
    }

    if (this.state.optionsVisible) {
      const lowerCaseState = this.state.textInput.toLowerCase();
      options.push(
        ...this.state.filteredOptions.map((option, i) => {
          const matchIndex = option.toLowerCase().indexOf(lowerCaseState);
          let beforeMatch;
          let highlightedMatch;
          let afterMatch;
          if (matchIndex >= 0) {
            beforeMatch = option.substring(0, matchIndex);
            const endOfMatchIndex = matchIndex + this.state.textInput.length;
            highlightedMatch = option.substring(matchIndex, endOfMatchIndex);
            afterMatch = option.substring(endOfMatchIndex, option.length);
          } else {
            beforeMatch = option;
          }
          const isSelected = i === this.state.selectedIndex;
          return (
            <li
              className={isSelected ? 'selected' : null}
              key={'option-' + option}
              onClick={this._handleItemClick.bind(this, option)}
              onMouseOver={this._setSelectedIndex.bind(this, i)}
              ref={isSelected ? 'selectedOption' : null}>
              {beforeMatch}
              <strong className="text-highlight">
                {highlightedMatch}
              </strong>
              {afterMatch}
            </li>
          );
        }),
      );

      if (!options.length) {
        options.push(
          <li className="text-subtle" key="no-results-found">
            No results found
          </li>,
        );
      }

      const rect = this.state.optionsRect || {left: 0, top: 0, width: 300};

      optionsContainer = (
        <Portal container={this._getOptionsElement()}>
          <div className="nuclide-combobox-options" style={rect}>
            <div className="select-list">
              <ol className="nuclide-combobox-list-group list-group">
                {options}
              </ol>
            </div>
          </div>
        </Portal>
      );
    }

    const {initialTextInput, placeholderText, size, width} = this.props;
    const wrapperStyle = {
      width: width == null ? undefined : `${width}px`,
    };
    return (
      <div
        className={
          'select-list popover-list popover-list-subtle ' + this.props.className
        }
        style={wrapperStyle}>
        <AtomInput
          initialValue={initialTextInput}
          onBlur={this._handleInputBlur}
          onClick={this._handleInputClick}
          onFocus={this._handleInputFocus}
          placeholderText={placeholderText}
          ref="freeformInput"
          size={size}
          width={width}
          disabled={this.props.disabled}
        />
        {optionsContainer}
      </div>
    );
  }
}
