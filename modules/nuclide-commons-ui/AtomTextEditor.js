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
import classnames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';
import {TextBuffer} from 'atom';
import {
  enforceReadOnly,
  enforceSoftWrap,
} from 'nuclide-commons-atom/text-editor';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

const doNothing = () => {};

type TextEditorSetup = {
  disposables: IDisposable,
  textEditor: atom$TextEditor,
};

function setupTextEditor(props: Props): TextEditorSetup {
  const textBuffer = props.textBuffer || new TextBuffer();
  if (props.path) {
    textBuffer.setPath(props.path);
  }

  const disposables = new UniversalDisposable();
  if (props.onDidTextBufferChange != null) {
    disposables.add(textBuffer.onDidChange(props.onDidTextBufferChange));
  }

  const textEditorParams = {
    buffer: textBuffer,
    lineNumberGutterVisible: !props.gutterHidden,
    autoHeight: props.autoGrow,
  };
  const textEditor: atom$TextEditor = atom.workspace.buildTextEditor(
    textEditorParams,
  );
  disposables.add(() => textEditor.destroy());

  if (props.grammar != null) {
    textEditor.setGrammar(props.grammar);
  }
  disposables.add(enforceSoftWrap(textEditor, props.softWrapped));

  if (props.placeholderText) {
    textEditor.setPlaceholderText(props.placeholderText);
  }

  if (props.readOnly) {
    enforceReadOnly(textEditor);

    // Remove the cursor line decorations because that's distracting in read-only mode.
    textEditor.getDecorations({class: 'cursor-line'}).forEach(decoration => {
      decoration.destroy();
    });
  }

  return {
    disposables,
    textEditor,
  };
}

type DefaultProps = {
  autoGrow: boolean,
  correctContainerWidth: boolean,
  disabled: boolean,
  gutterHidden: boolean,
  lineNumberGutterVisible: boolean,
  readOnly: boolean,
  syncTextContents: boolean,
  tabIndex: string,
  softWrapped: boolean,
};

type Props = {
  autoGrow: boolean,
  className?: string,
  correctContainerWidth: boolean,
  disabled: boolean,
  gutterHidden: boolean,
  grammar?: ?Object,
  onDidTextBufferChange?: (event: atom$TextEditEvent) => mixed,
  path?: string,
  placeholderText?: string,
  readOnly: boolean,
  textBuffer?: TextBuffer,
  syncTextContents: boolean,
  tabIndex: string,
  softWrapped: boolean,
};

export class AtomTextEditor extends React.Component {
  static defaultProps: DefaultProps = {
    correctContainerWidth: true,
    disabled: false,
    gutterHidden: false,
    lineNumberGutterVisible: true,
    readOnly: false,
    autoGrow: false,
    syncTextContents: true,
    tabIndex: '0', // Keep in line with other input elements.
    softWrapped: false,
  };

  props: Props;
  _textEditorElement: ?atom$TextEditorElement;
  _editorDisposables: UniversalDisposable;

  componentDidMount(): void {
    this._editorDisposables = new UniversalDisposable();
    this._updateTextEditor(setupTextEditor(this.props));
    this._onDidUpdateTextEditorElement(this.props);
    if (this.props.disabled) {
      this._updateDisabledState(true);
    }
  }

  _updateTextEditor(setup: TextEditorSetup): void {
    this._editorDisposables.dispose();
    const {textEditor, disposables} = setup;

    this._editorDisposables = new UniversalDisposable(disposables);

    const container = ReactDOM.findDOMNode(this);
    const textEditorElement: atom$TextEditorElement = (this._textEditorElement = (document.createElement(
      'atom-text-editor',
    ): any));
    textEditorElement.setModel(textEditor);
    textEditorElement.setAttribute('tabindex', this.props.tabIndex);
    // HACK! This is a workaround for the ViewRegistry where Atom has a default view provider for
    // TextEditor (that we cannot override), which is responsible for creating the view associated
    // with the TextEditor that we create and adding a mapping for it in its private views map.
    // To workaround this, we reach into the internals of the ViewRegistry and update the entry in
    // the map manually. Filed as https://github.com/atom/atom/issues/7954.
    // $FlowFixMe
    atom.views.views.set(textEditor, textEditorElement);

    if (this.props.correctContainerWidth) {
      this._editorDisposables.add(
        textEditorElement.onDidAttach(() => {
          const correctlySizedElement = textEditorElement.querySelector(
            '* /deep/ .lines > :first-child > :first-child',
          );
          if (correctlySizedElement == null) {
            return;
          }
          const {width} = correctlySizedElement.style;
          // $FlowFixMe
          container.style.width = width;
        }),
      );
    }

    // Attach to DOM.
    // $FlowFixMe
    container.innerHTML = '';
    // $FlowFixMe
    container.appendChild(textEditorElement);
  }

  componentWillReceiveProps(nextProps: Props): void {
    if (
      nextProps.textBuffer !== this.props.textBuffer ||
      nextProps.readOnly !== this.props.readOnly
    ) {
      const previousTextContents = this.getTextBuffer().getText();
      const nextTextContents = nextProps.textBuffer == null
        ? nextProps.textBuffer
        : nextProps.textBuffer.getText();
      if (nextTextContents !== previousTextContents) {
        const textEditorSetup = setupTextEditor(nextProps);

        if (nextProps.syncTextContents) {
          textEditorSetup.textEditor.setText(previousTextContents);
        }
        this._updateTextEditor(textEditorSetup);
        this._onDidUpdateTextEditorElement(nextProps);
      }
    }
    if (nextProps.path !== this.props.path) {
      this.getTextBuffer().setPath(nextProps.path || '');
    }
    if (nextProps.gutterHidden !== this.props.gutterHidden) {
      this.getModel().setLineNumberGutterVisible(nextProps.gutterHidden);
    }
    if (nextProps.grammar !== this.props.grammar) {
      this.getModel().setGrammar(nextProps.grammar);
    }
    if (nextProps.softWrapped !== this.props.softWrapped) {
      this.getModel().setSoftWrapped(nextProps.softWrapped);
    }
    if (nextProps.disabled !== this.props.disabled) {
      this._updateDisabledState(nextProps.disabled);
    }
  }

  _onDidUpdateTextEditorElement(props: Props): void {
    if (!props.readOnly) {
      return;
    }
    // TODO(most): t9929679 Remove this hack when Atom has a blinking cursor configuration API.
    const {component} = this.getElement();
    if (component == null) {
      return;
    }
    if (component.startCursorBlinking) {
      component.startCursorBlinking = doNothing;
      component.stopCursorBlinking();
    } else {
      const {presenter} = component;
      if (presenter == null) {
        return;
      }
      presenter.startBlinkingCursors = doNothing;
      presenter.stopBlinkingCursors(false);
    }
  }

  _updateDisabledState(isDisabled: boolean): void {
    // Hack to set TextEditor to read-only mode, per https://github.com/atom/atom/issues/6880
    if (isDisabled) {
      this.getElement().removeAttribute('tabindex');
    } else {
      this.getElement().setAttribute('tabindex', this.props.tabIndex);
    }
  }

  getTextBuffer(): atom$TextBuffer {
    return this.getModel().getBuffer();
  }

  getModel(): atom$TextEditor {
    return this.getElement().getModel();
  }

  getElement(): atom$TextEditorElement {
    invariant(this._textEditorElement);
    return this._textEditorElement;
  }

  render(): React.Element<any> {
    const className = classnames(
      this.props.className,
      'nuclide-text-editor-container',
      {
        'no-auto-grow': !this.props.autoGrow,
      },
    );
    return <div className={className} />;
  }

  // This component wraps the imperative API of `<atom-text-editor>`, and so React's rendering
  // should always pass because this subtree won't change.
  shouldComponentUpdate(nextProps: Object, nextState: void): boolean {
    return false;
  }

  componentWillUnmount(): void {
    this._editorDisposables.dispose();
  }
}
