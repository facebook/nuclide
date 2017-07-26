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

/* global HTMLElement */

import type SuggestionListType from './SuggestionList';

import {CompositeDisposable, Disposable} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';
import invariant from 'assert';

/**
 * We need to create this custom HTML element so we can hook into the view
 * registry. The overlay decoration only works through the view registry.
 */
class SuggestionListElement extends HTMLElement {
  _model: SuggestionListType;

  initialize(model: SuggestionListType) {
    this._model = model;
    return this;
  }

  attachedCallback(): mixed {
    ReactDOM.render(<SuggestionList suggestionList={this._model} />, this);
  }

  detachedCallback(): mixed {
    ReactDOM.unmountComponentAtNode(this);
  }

  dispose() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
}

type Props = {
  suggestionList: SuggestionListType,
};

type State = {
  selectedIndex: number,
};

class SuggestionList extends React.Component {
  props: Props;
  state: State;

  _items: Array<{rightLabel?: string, title: string, callback: () => mixed}>;
  _textEditor: ?atom$TextEditor;
  _subscriptions: atom$CompositeDisposable;
  _boundConfirm: () => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedIndex: 0,
    };
    this._subscriptions = new CompositeDisposable();
    this._boundConfirm = this._confirm.bind(this);
  }

  componentWillMount() {
    const {suggestionList} = this.props;
    const suggestion = suggestionList.getSuggestion();
    // TODO(nmote): This is assuming `suggestion.callback` is always an Array, which is not true
    //   according to hyperclick/lib/types. It can also be a function.
    invariant(suggestion != null && Array.isArray(suggestion.callback));
    this._items = suggestion.callback;
    this._textEditor = suggestionList.getTextEditor();
  }

  componentDidMount() {
    const textEditor = this._textEditor;
    invariant(textEditor);
    const textEditorView = atom.views.getView(textEditor);
    const boundClose = this._close.bind(this);
    this._subscriptions.add(
      atom.commands.add(textEditorView, {
        'core:move-up': this._moveSelectionUp.bind(this),
        'core:move-down': this._moveSelectionDown.bind(this),
        'core:move-to-top': this._moveSelectionToTop.bind(this),
        'core:move-to-bottom': this._moveSelectionToBottom.bind(this),
        'core:cancel': boundClose,
        'editor:newline': this._boundConfirm,
      }),
    );

    this._subscriptions.add(textEditor.onDidChange(boundClose));
    this._subscriptions.add(textEditor.onDidChangeCursorPosition(boundClose));

    // Prevent scrolling the editor when scrolling the suggestion list.
    const stopPropagation = event => event.stopPropagation();
    // $FlowFixMe
    ReactDOM.findDOMNode(this.refs.scroller).addEventListener(
      'mousewheel',
      stopPropagation,
    );
    this._subscriptions.add(
      new Disposable(() => {
        // $FlowFixMe
        ReactDOM.findDOMNode(this.refs.scroller).removeEventListener(
          'mousewheel',
          stopPropagation,
        );
      }),
    );

    const keydown = (event: KeyboardEvent) => {
      // If the user presses the enter key, confirm the selection.
      if (event.keyCode === 13) {
        event.stopImmediatePropagation();
        this._confirm();
      }
    };
    textEditorView.addEventListener('keydown', keydown);
    this._subscriptions.add(
      new Disposable(() => {
        textEditorView.removeEventListener('keydown', keydown);
      }),
    );
  }

  render() {
    const itemComponents = this._items.map((item, index) => {
      let className = 'hyperclick-result-item';
      if (index === this.state.selectedIndex) {
        className += ' selected';
      }
      return (
        <li
          className={className}
          key={index}
          onMouseDown={this._boundConfirm}
          onMouseEnter={this._setSelectedIndex.bind(this, index)}>
          {item.title}
          <span className="right-label">
            {item.rightLabel}
          </span>
        </li>
      );
    });

    return (
      <div
        className="popover-list select-list hyperclick-suggestion-list-scroller"
        ref="scroller">
        <ol className="list-group" ref="selectionList">
          {itemComponents}
        </ol>
      </div>
    );
  }

  componentDidUpdate(prevProps: Object, prevState: Object) {
    if (prevState.selectedIndex !== this.state.selectedIndex) {
      this._updateScrollPosition();
    }
  }

  componentWillUnmount() {
    this._subscriptions.dispose();
  }

  _confirm() {
    const openExternal = atom.config.get('hyperclick.openExternal');
    this._items[this.state.selectedIndex].callback(openExternal);
    this._close();
  }

  _close() {
    this.props.suggestionList.hide();
  }

  _setSelectedIndex(index: number) {
    this.setState({
      selectedIndex: index,
    });
  }

  _moveSelectionDown(event) {
    if (this.state.selectedIndex < this._items.length - 1) {
      this.setState({selectedIndex: this.state.selectedIndex + 1});
    } else {
      this._moveSelectionToTop();
    }
    if (event) {
      event.stopImmediatePropagation();
    }
  }

  _moveSelectionUp(event) {
    if (this.state.selectedIndex > 0) {
      this.setState({selectedIndex: this.state.selectedIndex - 1});
    } else {
      this._moveSelectionToBottom();
    }
    if (event) {
      event.stopImmediatePropagation();
    }
  }

  _moveSelectionToBottom(event) {
    this.setState({selectedIndex: Math.max(this._items.length - 1, 0)});
    if (event) {
      event.stopImmediatePropagation();
    }
  }

  _moveSelectionToTop(event) {
    this.setState({selectedIndex: 0});
    if (event) {
      event.stopImmediatePropagation();
    }
  }

  _updateScrollPosition() {
    const listNode = ReactDOM.findDOMNode(this.refs.selectionList);
    // $FlowFixMe
    const selectedNode = listNode.getElementsByClassName('selected')[0];
    // $FlowFixMe
    selectedNode.scrollIntoViewIfNeeded(false);
  }
}

export default document.registerElement('hyperclick-suggestion-list', {
  prototype: SuggestionListElement.prototype,
});
