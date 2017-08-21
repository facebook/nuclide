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

import classNames from 'classnames';

import {CompositeDisposable} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';

import {maybeToString} from 'nuclide-commons/string';

type DefaultProps = {
  disabled: boolean,
  autofocus: boolean,
  startSelected: boolean,
  initialValue: string,
  tabIndex: string,
  onClick: (event: SyntheticMouseEvent) => mixed,
  onDidChange: (text: string) => mixed,
  onFocus: () => mixed,
  onBlur: (blurEvent: Event) => mixed,
  unstyled: boolean,
  style: ?Object,
};

type Props = {
  className?: string,
  disabled: boolean,
  autofocus: boolean,
  startSelected: boolean,
  initialValue: string,
  placeholderText?: string,
  tabIndex: string,
  onFocus: () => mixed,
  onClick: (event: SyntheticMouseEvent) => mixed,
  onDidChange: (text: string) => mixed,
  onConfirm?: () => mixed,
  onCancel?: () => mixed,
  onBlur: (blurEvent: Event) => mixed,
  size?: 'xs' | 'sm' | 'lg',
  unstyled: boolean,
  width?: ?number,
  // If the `value` prop is specified, then the component's displayed text is controlled by this
  // prop.  Otherwise its displayed text must be imperatively set on the instance.
  value?: string,
  style: ?Object,
};

type State = {
  value: string,
};

/**
 * An input field rendered as an <atom-text-editor mini />.
 */
export class AtomInput extends React.Component {
  props: Props;
  state: State;

  _disposables: ?CompositeDisposable;

  static defaultProps: DefaultProps = {
    disabled: false,
    autofocus: false,
    startSelected: false,
    initialValue: '',
    tabIndex: '0', // Default to all <AtomInput /> components being in tab order
    onClick: event => {},
    onDidChange: text => {},
    onFocus: () => {},
    onBlur: () => {},
    unstyled: false,
    style: null,
  };

  constructor(props: Props) {
    super(props);
    const value = props.value == null ? props.initialValue : props.value;
    this.state = {
      value,
    };
  }

  componentDidMount(): void {
    const disposables = (this._disposables = new CompositeDisposable());

    // There does not appear to be any sort of infinite loop where calling
    // setState({value}) in response to onDidChange() causes another change
    // event.
    const textEditor = this.getTextEditor();
    const textEditorElement = this.getTextEditorElement();
    if (this.props.autofocus) {
      this.focus();
    }
    if (this.props.startSelected) {
      // For some reason, selectAll() has no effect if called right now.
      process.nextTick(() => {
        if (!textEditor.isDestroyed()) {
          textEditor.selectAll();
        }
      });
    }
    disposables.add(
      atom.commands.add(textEditorElement, {
        'core:confirm': () => {
          if (this.props.onConfirm != null) {
            this.props.onConfirm();
          }
        },
        'core:cancel': () => {
          if (this.props.onCancel != null) {
            this.props.onCancel();
          }
        },
      }),
    );
    const placeholderText = this.props.placeholderText;
    if (placeholderText != null) {
      textEditor.setPlaceholderText(placeholderText);
    }
    this.getTextEditorElement().setAttribute('tabindex', this.props.tabIndex);
    if (this.props.disabled) {
      this._updateDisabledState(true);
    }

    // Set the text editor's initial value and keep the cursor at the beginning of the line. Cursor
    // position was documented in a test and is retained here after changes to how text is set in
    // the text editor. (see focus-related spec in AtomInput-spec.js)
    this.setText(this.state.value);
    this.getTextEditor().moveToBeginningOfLine();

    // Begin listening for changes only after initial value is set.
    disposables.add(
      textEditor.onDidChange(() => {
        this.setState({value: textEditor.getText()});
        this.props.onDidChange.call(null, textEditor.getText());
      }),
    );

    this._updateWidth();
  }

  componentWillReceiveProps(nextProps: Props): void {
    if (nextProps.disabled !== this.props.disabled) {
      this._updateDisabledState(nextProps.disabled);
    }
    const {value, placeholderText} = nextProps;
    if (typeof value === 'string' && value !== this.props.value) {
      // If the `value` prop is specified, then we must update the input area when there is new
      // text, and this includes maintaining the correct cursor position.
      this.setState({value});
      const editor = this.getTextEditor();
      const cursorPosition = editor.getCursorBufferPosition();
      this.setText(value);
      editor.setCursorBufferPosition(cursorPosition);
    }

    if (placeholderText !== this.props.placeholderText) {
      this.getTextEditor().setPlaceholderText(placeholderText || '');
    }
  }

  componentDidUpdate(prevProps: Object, prevState: Object): void {
    this._updateWidth(prevProps.width);
  }

  componentWillUnmount(): void {
    // Note that destroy() is not part of TextEditor's public API.
    this.getTextEditor().destroy();

    if (this._disposables) {
      this._disposables.dispose();
      this._disposables = null;
    }
  }

  _updateDisabledState(isDisabled: boolean): void {
    // Hack to set TextEditor to read-only mode, per https://github.com/atom/atom/issues/6880
    if (isDisabled) {
      this.getTextEditorElement().removeAttribute('tabindex');
    } else {
      this.getTextEditorElement().setAttribute('tabindex', this.props.tabIndex);
    }
  }

  render(): React.Element<any> {
    const className = classNames(this.props.className, {
      'atom-text-editor-unstyled': this.props.unstyled,
      [`atom-text-editor-${maybeToString(this.props.size)}`]:
        this.props.size != null,
    });

    return (
      // Because the contents of `<atom-text-editor>` elements are managed by its custom web
      // component class when "Use Shadow DOM" is disabled, this element should never have children.
      // If an element has no children, React guarantees it will never re-render the element (which
      // would wipe out the web component's work in this case).
      <atom-text-editor
        class={className}
        mini
        onClick={this.props.onClick}
        onFocus={this.props.onFocus}
        onBlur={this.props.onBlur}
        style={this.props.style}
      />
    );
  }

  getText(): string {
    return this.state.value;
  }

  setText(text: string) {
    this.getTextEditor().setText(text);
  }

  getTextEditor(): TextEditor {
    return this.getTextEditorElement().getModel();
  }

  onDidChange(callback: () => any): IDisposable {
    return this.getTextEditor().onDidChange(callback);
  }

  getTextEditorElement(): atom$TextEditorElement {
    // $FlowFixMe
    return ReactDOM.findDOMNode(this);
  }

  _updateWidth(prevWidth?: number): void {
    if (this.props.width !== prevWidth) {
      const width = this.props.width == null ? undefined : this.props.width;
      this.getTextEditorElement().setWidth(width);
    }
  }

  focus(): void {
    this.getTextEditor().moveToEndOfLine();
    this.getTextEditorElement().focus();
  }
}
