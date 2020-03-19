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

import type {HyperclickSuggestion} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {scrollIntoViewIfNeeded} from 'nuclide-commons-ui/scrollIntoView';
import invariant from 'assert';

type Props = {
  suggestionList: SuggestionList,
};

type State = {
  selectedIndex: number,
};

export default class SuggestionList {
  _element: ?SuggestionListElement;
  _textEditor: atom$TextEditor;
  _suggestion: HyperclickSuggestion;
  _suggestionMarker: ?atom$Marker;
  _overlayDecoration: ?atom$Decoration;

  getElement(): SuggestionListElement {
    if (this._element == null) {
      this._element = new SuggestionListHTMLElement().initialize(this);
    }
    return this._element;
  }

  show(textEditor: atom$TextEditor, suggestion: HyperclickSuggestion): void {
    if (!textEditor || !suggestion) {
      return;
    }

    this._textEditor = textEditor;
    this._suggestion = suggestion;

    this.hide();

    const {range} = suggestion;
    invariant(range);
    const {start: position} = Array.isArray(range) ? range[0] : range;
    this._suggestionMarker = textEditor.markBufferPosition(position);
    if (this._suggestionMarker) {
      this._overlayDecoration = textEditor.decorateMarker(
        this._suggestionMarker,
        {
          type: 'overlay',
          item: this,
        },
      );
    }
  }

  hide() {
    // $FlowFixMe method override not working with `this`.
    atom.views.getView(this).dispose();
    if (this._suggestionMarker) {
      this._suggestionMarker.destroy();
    } else if (this._overlayDecoration) {
      this._overlayDecoration.destroy();
    }
    this._suggestionMarker = undefined;
    this._overlayDecoration = undefined;
  }

  getTextEditor(): ?TextEditor {
    return this._textEditor;
  }

  getSuggestion(): ?HyperclickSuggestion {
    return this._suggestion;
  }
}

/**
 * We need to create this custom HTML element so we can hook into the view
 * registry. The overlay decoration only works through the view registry.
 */
class SuggestionListElement extends HTMLElement {
  _model: SuggestionList;

  initialize(model: SuggestionList) {
    this._model = model;
    return this;
  }

  attachedCallback(): mixed {
    ReactDOM.render(
      <SuggestionListComponent suggestionList={this._model} />,
      this,
    );
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

class SuggestionListComponent extends React.Component<Props, State> {
  _items: Array<{rightLabel?: string, title: string, callback: () => mixed}>;
  _textEditor: ?atom$TextEditor;
  _subscriptions: UniversalDisposable;
  _boundConfirm: () => void;

  _scroller: ?HTMLElement;
  _selectionList: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedIndex: 0,
    };
    this._subscriptions = new UniversalDisposable();
    this._boundConfirm = this._confirm.bind(this);
  }

  UNSAFE_componentWillMount() {
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

    this._subscriptions.add(textEditor.getBuffer().onDidChangeText(boundClose));
    this._subscriptions.add(textEditor.onDidChangeCursorPosition(boundClose));

    // Prevent scrolling the editor when scrolling the suggestion list.
    const stopPropagation = event => event.stopPropagation();
    const scroller = this._scroller;
    invariant(scroller != null);
    scroller.addEventListener('mousewheel', stopPropagation);
    this._subscriptions.add(
      new UniversalDisposable(() => {
        scroller.removeEventListener('mousewheel', stopPropagation);
      }),
    );

    const keydown = (event: KeyboardEvent) => {
      // If the user presses the enter key, confirm the selection.
      if (event.keyCode === 13) {
        event.stopPropagation();
        this._confirm();
      }
    };
    textEditorView.addEventListener('keydown', keydown);
    this._subscriptions.add(
      new UniversalDisposable(() => {
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
          <span className="right-label">{item.rightLabel}</span>
        </li>
      );
    });

    return (
      <div
        className="popover-list select-list hyperclick-suggestion-list-scroller"
        ref={el => {
          this._scroller = el;
        }}>
        <ol
          className="list-group"
          ref={el => {
            this._selectionList = el;
          }}>
          {itemComponents}
        </ol>
      </div>
    );
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState.selectedIndex !== this.state.selectedIndex) {
      this._updateScrollPosition();
    }
  }

  componentWillUnmount() {
    this._subscriptions.dispose();
  }

  _confirm(event) {
    this._items[this.state.selectedIndex].callback();
    this._close();
    if (event) {
      event.stopPropagation();
    }
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
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
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
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
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
    const listNode = this._selectionList;
    invariant(listNode != null);
    const selectedNode = listNode.getElementsByClassName('selected')[0];
    scrollIntoViewIfNeeded(selectedNode, false);
  }
}

const SuggestionListHTMLElement = document.registerElement(
  'hyperclick-suggestion-list',
  {
    prototype: SuggestionListElement.prototype,
  },
);
