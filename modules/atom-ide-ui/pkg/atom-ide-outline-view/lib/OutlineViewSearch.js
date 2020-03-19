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
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Icon} from 'nuclide-commons-ui/Icon';
import {goToLocationInEditor} from 'nuclide-commons-atom/go-to-location';
import debounce from 'nuclide-commons/debounce';
import analytics from 'nuclide-commons/analytics';

import type {OutlineTreeForUi} from './createOutlines';

export type SearchResult = {
  matches: boolean,
  visible: boolean,
  matchingCharacters?: Array<number>,
};

type Props = {|
  query: string,
  onQueryChange: string => void,
  editor: atom$TextEditor,
  outlineTrees: Array<OutlineTreeForUi>,
  searchResults: Map<OutlineTreeForUi, SearchResult>,
|};

export class OutlineViewSearchComponent extends React.Component<Props> {
  _inputRef: ?React.ElementRef<typeof AtomInput>;

  SEARCH_PLACEHOLDER = 'Filter';
  DEBOUNCE_TIME = 100;

  _handleInputRef = (element: ?React.ElementRef<typeof AtomInput>) => {
    this._inputRef = element;
  };

  focus() {
    if (this._inputRef != null) {
      this._inputRef.focus();
    }
  }

  _findFirstResult(
    searchResults: Map<OutlineTreeForUi, SearchResult>,
    tree: Array<OutlineTreeForUi>,
  ): ?OutlineTreeForUi {
    for (let i = 0; i < tree.length; i++) {
      const result = searchResults.get(tree[i]);
      if (result && result.matches) {
        return tree[i];
      }
      const child = this._findFirstResult(searchResults, tree[i].children);
      if (child) {
        return child;
      }
    }
  }

  _onConfirm = () => {
    const firstElement = this._findFirstResult(
      this.props.searchResults,
      this.props.outlineTrees,
    );
    if (firstElement == null) {
      return;
    }
    const pane = atom.workspace.paneForItem(this.props.editor);
    if (pane == null) {
      return;
    }
    analytics.track('outline-view:search-enter');
    pane.activate();
    pane.activateItem(this.props.editor);
    const landingPosition: atom$Point =
      firstElement.landingPosition != null
        ? firstElement.landingPosition
        : firstElement.startPosition;
    goToLocationInEditor(this.props.editor, {
      line: landingPosition.row,
      column: landingPosition.column,
    });
    this.props.onQueryChange('');
  };

  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _onDidChange = debounce(query => {
    analytics.track('outline-view:change-query');
    this.props.onQueryChange(query);
  }, this.DEBOUNCE_TIME);

  _onDidClear = () => {
    this.props.onQueryChange('');
  };

  render(): React.Node {
    return (
      <div className="outline-view-search-bar">
        <AtomInput
          className="outline-view-search-pane"
          onConfirm={this._onConfirm}
          onCancel={this._onDidClear}
          onDidChange={this._onDidChange}
          placeholderText={this.props.query || this.SEARCH_PLACEHOLDER}
          ref={this._handleInputRef}
          value={this.props.query}
          size="sm"
        />
        {this.props.query.length > 0 ? (
          <Icon
            icon="x"
            className="outline-view-search-clear"
            onClick={this._onDidClear}
          />
        ) : null}
      </div>
    );
  }
}
