/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */
import type {ElementOptions, Keypress} from 'blessed';
import * as DebugProtocol from 'vscode-debugprotocol';
import {Observable} from 'rxjs';
// $FlowFixMe - make UniversalDisposable flow strict
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import blessed from 'blessed';

export interface Completions {
  getCompletions(
    text: string,
    column: number,
  ): Promise<Array<DebugProtocol.CompletionItem>>;
}

export class CompletionsDialog extends blessed.widget.List {
  _completionsGetter: ?Completions;
  _allItems: Array<DebugProtocol.CompletionItem>;
  _filteredItems: Array<DebugProtocol.CompletionItem>;
  _prefix: string;
  _showDisposable: UniversalDisposable;

  constructor(options: ElementOptions) {
    super(options);
    this._showDisposable = new UniversalDisposable();
    this.on('select', (e, n) => this._select(n));
    this.on('cancel', () => this._cancel());
  }

  setCompletions(completionsGetter: Completions) {
    // This unfortunately can't be set in the constructor as the
    // console is brought up before the debugger
    this._completionsGetter = completionsGetter;
  }

  async selectCompletion(buffer: string, cursor: number): Promise<void> {
    const comp = this._completionsGetter;

    if (comp == null) {
      this.emit('nocompletions');
      return;
    }

    try {
      const items = await comp.getCompletions(buffer, cursor);
      if (this._populateCompletionList(items, buffer, cursor)) {
        this._showDisposable = new UniversalDisposable();
        this._showDisposable.add(
          Observable.fromEvent(this, 'keypress')
            .map(([ch, key]) => this._updatePrefix(ch, key))
            .subscribe(),
        );
        this.show();
        this.screen.render();
      }
    } catch (_) {
      this.emit('nocompletions');
    }
  }

  _populateCompletionList(
    items: Array<DebugProtocol.CompletionItem>,
    buffer: string,
    cursor: number,
  ): boolean {
    const wordStart = buffer.lastIndexOf(' ', cursor) + 1;
    const m = buffer.substr(wordStart).match(/\W*/);
    this._prefix = buffer.substr(
      wordStart + (m == null ? 0 : m[0].length),
      cursor - wordStart,
    );
    this._allItems = items;
    this._filteredItems = this._filterItems(this._prefix);

    if (this._filteredItems.length === 0) {
      this.emit('nocompletions');
      return false;
    }

    const top = this.screen.height - 2 - this.height;
    const left = cursor;
    const height = 25;

    // width must include space for a character on each side of the box for the
    // border characters, plus a little extra to not look crowded
    const borderWidth = 4;
    const width = Math.min(
      borderWidth +
        this._allItems.reduce(
          (acc, item) => Math.max(acc, item.label.length),
          0,
        ),
      this.screen.width - left,
    );

    this.position = {top, left, width, height};

    this.setItems(this._screenItems());
    this.focus();

    return true;
  }

  // completions tend to return everything regardless of the parameters given,
  // so filter down the list based on the prefix passed in
  _filterItems(prefix: string): Array<DebugProtocol.CompletionItem> {
    return this._allItems.filter(item => {
      const text = item.text != null ? item.text : item.label;
      return text.startsWith(prefix);
    });
  }

  // build the list of screen items, setting the part of each item that matches
  // the user's prefix in bold
  _screenItems(): Array<string> {
    const prefixLen = this._prefix.length;
    return this._filteredItems.map(
      item =>
        `{bold}${item.label.substr(0, prefixLen)}{/bold}${item.label.substr(
          prefixLen,
        )}`,
    );
  }

  // redraw an updated version of the list on the screen, and attempt
  // keep the same item selected if it still exists in the list
  _updateList(newItems: Array<DebugProtocol.CompletionItem>): void {
    const selectedItem = this._filteredItems[this.selected];
    this._filteredItems = newItems;
    this.setItems(this._screenItems());
    if (selectedItem != null) {
      const newIndex = this._filteredItems.findIndex(
        ele => ele.label === selectedItem.label,
      );
      if (newIndex !== -1) {
        this.select(newIndex);
      }
    }

    this.screen.render();
  }

  // update the prefix based on keystrokes. this allows the user to narrow
  // the scope of completion by typing more characters.
  _updatePrefix(ch: string, key: Keypress): void {
    if (key.name === 'delete' || key.name === 'backspace') {
      if (this._prefix !== '') {
        this._prefix = this._prefix.substr(0, this._prefix.length - 1);
        this._filteredItems = this._filterItems(this._prefix);
        this._updateList(this._filteredItems);
      }
    }

    if (ch != null) {
      const newItems = this._filterItems(this._prefix + ch);
      if (newItems.length === 0) {
        return;
      }
      this._prefix += ch;
      this._updateList(newItems);
      return;
    }
  }

  // selection event from the underlying list control. convert it into an event
  // that contains the selected completion item
  _select(n: number): void {
    this._showDisposable.dispose();
    this.hide();

    const item = this._filteredItems[n];
    if (item == null) {
      this.emit('cancel');
      return;
    }

    this.emit('selected_item', item);
  }

  _cancel(): void {
    this._showDisposable.dispose();
  }
}
