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

import type {AtomTextEditor} from './AtomTextEditor';
import type {MessageType} from './Message';
import {Message} from './Message';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import invariant from 'assert';

export class TextEditorBanner {
  _disposables: UniversalDisposable;
  _editor: atom$TextEditor | AtomTextEditor;
  _element: HTMLElement;
  _editorElement: HTMLElement;
  _marker: ?atom$Marker;

  constructor(editor: atom$TextEditor | AtomTextEditor) {
    this._editor = editor;
    const editorElement = editor.getElement().firstChild;
    this._element = document.createElement('div');
    this._element.className = 'nuclide-ui-text-editor-banner-container';

    invariant(
      editorElement instanceof HTMLElement && editorElement.parentNode != null,
    );

    editorElement.parentNode.insertBefore(this._element, editorElement);
    this._editorElement = editorElement;

    this._disposables = new UniversalDisposable(
      () => {
        ReactDOM.unmountComponentAtNode(this._element);
        this._element.replaceWith(editorElement);
      },
      atom.workspace.observeActiveTextEditor(activeEditor => {
        if (activeEditor == null) {
          return;
        }
        if (activeEditor.getElement().contains(editor.getElement())) {
          // This is needed for situations where the editor was rendered while
          // display: none so _updateTextEditorElement wasn't able to properly
          // measure at that time.
          editor.getElement().measureDimensions();
        }
      }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _updateTextEditorElement(editorContainerRef: ?React.ElementRef<'div'>) {
    const editorContainerNode = ReactDOM.findDOMNode(editorContainerRef);
    if (editorContainerNode == null) {
      return;
    }

    // Clear the previous child
    while (editorContainerNode.lastChild) {
      editorContainerNode.removeChild(editorContainerNode.lastChild);
    }

    // And insert the new one instead
    editorContainerNode.appendChild(this._editorElement);
    this._editor.getElement().measureDimensions();

    // Fix for Hyperclicking a read-only file.
    // Restore the scroll position in the editor.
    this._editor
      .getElement()
      .getModel()
      .scrollToCursorPosition();
  }

  render = (reactElement: React.Element<any>): void => {
    this.renderUnstyled(
      <div className="nuclide-ui-text-editor-banner-element">
        {reactElement}
      </div>,
    );
  };

  renderUnstyled = (reactElement: React.Element<any>): void => {
    ReactDOM.render(
      <div className="nuclide-ui-text-editor-banner">
        {reactElement}
        <div
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={ref => this._updateTextEditorElement(ref)}
          className="nuclide-ui-text-editor-banner-editor"
        />
      </div>,
      this._element,
    );
  };

  hide() {
    this.dispose();
  }
}

type NoticeProps = {|
  messageType: MessageType,
  children: React.Node,
  contentStyle?: {[key: string]: any},
|};

export class Notice extends React.Component<NoticeProps> {
  render() {
    return (
      <div className="nuclide-ui-text-editor-banner-notice">
        <Message type={this.props.messageType}>
          <div
            className="nuclide-ui-text-editor-banner-notice-content"
            style={this.props.contentStyle}>
            {this.props.children}
          </div>
        </Message>
      </div>
    );
  }
}
