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

import * as React from 'react';
import classNames from 'classnames';
import invariant from 'assert';

import {maybeToString} from 'nuclide-commons/string';
import {microtask} from 'nuclide-commons/observable';
import debounce from 'nuclide-commons/debounce';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import atomTabIndexForwarder from './atomTabIndexForwarder';

type Props = {
  className?: string,
  disabled: boolean,
  autofocus: boolean,
  startSelected: boolean,
  startSelectedRange?: ?[number, number],
  initialValue: string,
  invalid?: boolean,
  placeholderText?: string,
  tabIndex: string,
  onFocus: () => mixed,
  onClick: (event: SyntheticMouseEvent<>) => mixed,
  onDidChange: (text: string) => mixed,
  onDidChangeSelectionRange?: (event: atom$ChangeSelectionRangeEvent) => mixed,
  onConfirm?: (event?: atom$CustomEvent) => mixed,
  onCancel?: (event?: atom$CustomEvent) => mixed,
  onBlur: (blurEvent: Event) => mixed,
  size?: 'xs' | 'sm' | 'lg',
  unstyled: boolean,
  width?: ?number,
  // If the `value` prop is specified, then the component's displayed text is controlled by this
  // prop.  Otherwise its displayed text must be imperatively set on the instance.
  value?: string,
  style: ?Object,
};

type State = {|
  value: string,
|};

const BLUR_FOCUS_DEBOUNCE_DELAY = 100;

/**
 * An input field rendered as an <atom-text-editor mini />.
 */
export class AtomInput extends React.Component<Props, State> {
  _disposables: ?UniversalDisposable;
  _rootNode: ?HTMLElement;
  _debouncedEditorBlur: (blurEvent: Event) => void;
  _debouncedEditorFocus: () => void;
  _isFocused: boolean;
  _tabIndexForwarding: ?IDisposable;

  static defaultProps = {
    disabled: false,
    autofocus: false,
    startSelected: false,
    initialValue: '',
    tabIndex: '0', // Default to all <AtomInput /> components being in tab order
    onClick: () => {},
    onDidChange: () => {},
    onFocus: () => {},
    onBlur: () => {},
    unstyled: false,
    style: null,
  };

  static getDerivedStateFromProps(props: Props) {
    const partialState = {};
    if (props.value != null) {
      partialState.value = props.value;
    }

    return partialState;
  }

  constructor(props: Props) {
    super(props);

    this.state = {
      value: props.value ?? props.initialValue,
    };
    this._debouncedEditorFocus = debounce(
      this._onEditorFocus,
      BLUR_FOCUS_DEBOUNCE_DELAY,
    );
    this._debouncedEditorBlur = debounce(
      this._onEditorBlur,
      BLUR_FOCUS_DEBOUNCE_DELAY,
    );
  }

  componentDidMount(): void {
    const disposables = (this._disposables = new UniversalDisposable());

    // There does not appear to be any sort of infinite loop where calling
    // setState({value}) in response to onDidChange() causes another change
    // event.
    const textEditor = this.getTextEditor();
    const textEditorElement = this.getTextEditorElement();
    if (this.props.autofocus) {
      this.focus();
    }

    invariant(
      !(this.props.startSelected && this.props.startSelectedRange != null),
      'cannot have both startSelected (all) and startSelectedRange',
    );

    if (this.props.startSelected) {
      // For some reason, selectAll() has no effect if called right now.
      disposables.add(
        microtask.subscribe(() => {
          if (!textEditor.isDestroyed()) {
            textEditor.selectAll();
          }
        }),
      );
    }

    const startSelectedRange = this.props.startSelectedRange;
    if (startSelectedRange != null) {
      // For some reason, selectAll() has no effect if called right now.
      disposables.add(
        microtask.subscribe(() => {
          if (!textEditor.isDestroyed()) {
            textEditor.setSelectedBufferRange([
              [0, startSelectedRange[0]],
              [0, startSelectedRange[1]],
            ]);
          }
        }),
      );
    }

    disposables.add(
      atom.commands.add(textEditorElement, {
        'core:confirm': event => {
          if (this.props.onConfirm != null) {
            this.props.onConfirm(event);
          }
        },
        'core:cancel': event => {
          if (this.props.onCancel != null) {
            this.props.onCancel(event);
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
    if (this.props.onDidChangeSelectionRange != null) {
      disposables.add(
        textEditor.onDidChangeSelectionRange(
          this.props.onDidChangeSelectionRange,
        ),
      );
    }

    this._updateWidth();
  }

  componentDidUpdate(prevProps: Object, prevState: Object): void {
    this._updateWidth(prevProps.width);

    if (prevProps.disabled !== this.props.disabled) {
      this._updateDisabledState(this.props.disabled);
    }

    const newValue = this.props.value;
    if (newValue != null && prevProps.value !== newValue) {
      const editor = this.getTextEditor();
      // Calling setText if the value did not change will redundantly call any
      // onDidChange listeners with the same input.
      if (editor.getText() !== newValue) {
        const cursorPosition = editor.getCursorBufferPosition();
        this.setText(newValue);
        editor.setCursorBufferPosition(cursorPosition);
      }
    }

    if (prevProps.placeholderText !== this.props.placeholderText) {
      this.getTextEditor().setPlaceholderText(this.props.placeholderText || '');
    }
  }

  componentWillUnmount(): void {
    // Note that destroy() is not part of TextEditor's public API.
    const editor = this.getTextEditor();
    process.nextTick(() => editor.destroy());

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

  _onEditorFocus = (): void => {
    if (this.isFocused() && !this._isFocused) {
      this._isFocused = true;
      this.props.onFocus && this.props.onFocus();
    }
  };

  _onEditorBlur = (blurEvent: Event): void => {
    if (!this.isFocused() && this._isFocused) {
      this._isFocused = false;
      this.props.onBlur && this.props.onBlur(blurEvent);
    }
  };

  isFocused(): boolean {
    return (
      this._rootNode != null && this._rootNode.contains(document.activeElement)
    );
  }

  render(): React.Node {
    const className = classNames(this.props.className, {
      'atom-text-editor-unstyled': this.props.unstyled,
      [`atom-text-editor-${maybeToString(this.props.size)}`]:
        this.props.size != null,
      'atom-text-editor-invalid': this.props.invalid,
    });

    return (
      // Because the contents of `<atom-text-editor>` elements are managed by its custom web
      // component class when "Use Shadow DOM" is disabled, this element should never have children.
      // If an element has no children, React guarantees it will never re-render the element (which
      // would wipe out the web component's work in this case).
      <atom-text-editor
        class={className}
        mini
        ref={this._textEditorRef}
        onClick={this.props.onClick}
        onFocus={this._debouncedEditorFocus}
        onBlur={this._debouncedEditorBlur}
        style={this.props.style}
      />
    );
  }

  _textEditorRef = (rootNode: ?HTMLElement): void => {
    this._rootNode = rootNode;
    if (rootNode == null) {
      if (this._tabIndexForwarding != null) {
        this._tabIndexForwarding.dispose();
        this._tabIndexForwarding = null;
      }
    } else {
      this._tabIndexForwarding = atomTabIndexForwarder(rootNode);
    }
  };

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
    return this.getTextEditor()
      .getBuffer()
      .onDidChangeText(callback);
  }

  getTextEditorElement(): atom$TextEditorElement {
    invariant(this._rootNode != null);
    // $FlowFixMe
    return this._rootNode;
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
