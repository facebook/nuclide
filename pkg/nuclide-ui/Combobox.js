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

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullthrows from 'nullthrows';
import {Observable} from 'rxjs';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {scrollIntoViewIfNeeded} from 'nuclide-commons-ui/scrollIntoView';

type DefaultProps = {
  className: string,
  maxOptionCount: number,
  onChange: (newValue: string) => mixed,
  onSelect: (newValue: string) => mixed,
  wrapperStyle: ?mixed,
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
export class Combobox extends React.Component<Props, State> {
  _freeformInput: ?AtomInput;
  _optionsElement: HTMLElement;
  _updateSubscription: ?rxjs$ISubscription;
  _selectedOption: ?HTMLElement;
  _subscriptions: UniversalDisposable;

  static defaultProps: DefaultProps = {
    className: '',
    maxOptionCount: 10,
    onChange: (newValue: string) => {},
    onSelect: (newValue: string) => {},
    disabled: false,
    wrapperStyle: {},
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
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
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
    nullthrows(this._freeformInput).setText(newValue);
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
    return nullthrows(this._freeformInput).getText();
  }

  focus(): void {
    nullthrows(this._freeformInput).focus();
  }

  scrollToEnd(): void {
    nullthrows(this._freeformInput)
      .getTextEditor()
      .moveToEndOfLine();
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
      const workspaceElement = document.body;
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
    const newText = nullthrows(this._freeformInput).getText();
    if (newText === this.state.textInput) {
      return;
    }
    this.requestUpdate(newText);
    const filteredOptions = this._getFilteredOptions(
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
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
    this._handleCancel();
    const {onBlur} = this.props;
    if (onBlur != null) {
      onBlur(this.getText());
    }
  };

  _handleInputClick = (): void => {
    this.setState({optionsVisible: true});
  };

  _handleItemClick(selectedValue: string, event: Object): void {
    this.selectValue(selectedValue, () => {
      // Focus the input again because the click will cause the input to blur. This mimics native
      // <select> behavior by keeping focus in the form being edited.
      const input = ReactDOM.findDOMNode(this._freeformInput);
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
          // TODO: (wbinnssmith) T30771435 this setState depends on current state
          // and should use an updater function rather than an object
          /* eslint-disable react/no-access-state-in-setstate */
          this.state.selectedIndex + 1,
          this.state.filteredOptions.length - 1,
          /* eslint-enable react/no-access-state-in-setstate */
        ),
      },
      this._scrollSelectedOptionIntoViewIfNeeded,
    );
  };

  _handleMoveUp = () => {
    this.setState(
      {
        // TODO: (wbinnssmith) T30771435 this setState depends on current state
        // and should use an updater function rather than an object
        // eslint-disable-next-line react/no-access-state-in-setstate
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
    if (this._selectedOption != null) {
      scrollIntoViewIfNeeded(this._selectedOption);
    }
  };

  _handleSelectedOption = (el: ?HTMLElement): void => {
    this._selectedOption = el;
  };

  render(): React.Node {
    let optionsContainer;
    const options = [];

    // flowlint-next-line sketchy-null-string:off
    if (this.props.loadingMessage && this.state.loadingOptions) {
      options.push(
        <li key="loading-text" className="loading">
          <span className="loading-message">{this.props.loadingMessage}</span>
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
              onMouseDown={e => {
                // Prevent the input's blur event from firing.
                e.preventDefault();
              }}
              onClick={this._handleItemClick.bind(this, option)}
              onMouseOver={this._setSelectedIndex.bind(this, i)}
              // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
              ref={isSelected ? this._handleSelectedOption : null}>
              {beforeMatch}
              <strong className="text-highlight">{highlightedMatch}</strong>
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

      optionsContainer = ReactDOM.createPortal(
        <div className="nuclide-combobox-options" style={rect}>
          <div className="select-list">
            <ol className="nuclide-combobox-list-group list-group">
              {options}
            </ol>
          </div>
        </div>,
        this._getOptionsElement(),
      );
    }

    const {initialTextInput, placeholderText, size, wrapperStyle} = this.props;
    return (
      <div
        className={
          'select-list popover-list popover-list-subtle ' + this.props.className
        }
        style={wrapperStyle}
        title={this._freeformInput != null ? this.getText() : ''}>
        <AtomInput
          initialValue={initialTextInput}
          onBlur={this._handleInputBlur}
          onClick={this._handleInputClick}
          onFocus={this._handleInputFocus}
          onConfirm={this._handleConfirm}
          onCancel={this._handleCancel}
          onDidChange={this._handleTextInputChange}
          placeholderText={placeholderText}
          ref={input => {
            this._freeformInput = input;
          }}
          size={size}
          disabled={this.props.disabled}
        />
        {optionsContainer}
      </div>
    );
  }
}
