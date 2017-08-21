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

import type {Observable} from 'rxjs';
import type {OutlineForUi, OutlineTreeForUi} from './createOutlines';
import type {TextToken} from 'nuclide-commons/tokenized-text';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import React from 'react';
import invariant from 'assert';
import classnames from 'classnames';

import analytics from 'nuclide-commons-atom/analytics';
import {goToLocationInEditor} from 'nuclide-commons-atom/go-to-location';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';
import {EmptyState} from 'nuclide-commons-ui/EmptyState';

import featureConfig from 'nuclide-commons-atom/feature-config';
import type {SearchResult} from './OutlineViewSearch';
import {OutlineViewSearchComponent} from './OutlineViewSearch';
import groupMatchIndexes from 'nuclide-commons/groupMatchIndexes';

const SEARCH_ENABLED_DEFAULT = true;

type State = {
  outline: OutlineForUi,
  searchEnabled: boolean,
};

type Props = {
  outlines: Observable<OutlineForUi>,
};

const TOKEN_KIND_TO_CLASS_NAME_MAP = {
  keyword: 'syntax--keyword',
  'class-name': 'syntax--entity syntax--name syntax--class',
  constructor: 'syntax--entity syntax--name syntax--function',
  method: 'syntax--entity syntax--name syntax--function',
  param: 'syntax--variable',
  string: 'syntax--string',
  whitespace: '',
  plain: '',
  type: 'syntax--support syntax--type',
};

export class OutlineView extends React.PureComponent {
  state: State;
  props: Props;

  subscription: ?UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {
      outline: {
        kind: 'empty',
      },
      searchEnabled: featureConfig.getWithDefaults(
        'atom-ide-outline-view.searchEnabled',
        SEARCH_ENABLED_DEFAULT,
      ),
    };
  }

  componentDidMount(): void {
    invariant(this.subscription == null);
    this.subscription = new UniversalDisposable(
      this.props.outlines.subscribe(outline => {
        this.setState({outline});
      }),
      featureConfig
        .observeAsStream('atom-ide-outline-view.searchEnabled')
        .subscribe((searchEnabled: mixed) => {
          if (typeof searchEnabled === 'boolean') {
            this.setState({searchEnabled});
          } else {
            this.setState({searchEnabled: SEARCH_ENABLED_DEFAULT});
          }
        }),
    );
  }

  componentWillUnmount(): void {
    invariant(this.subscription != null);
    this.subscription.unsubscribe();
    this.subscription = null;
  }

  render(): React.Element<any> {
    return (
      <div className="nuclide-outline-view">
        <OutlineViewComponent
          outline={this.state.outline}
          searchEnabled={this.state.searchEnabled}
        />
      </div>
    );
  }
}

type OutlineViewComponentProps = {
  outline: OutlineForUi,
  searchEnabled: boolean,
};

class OutlineViewComponent extends React.PureComponent {
  props: OutlineViewComponentProps;

  constructor(props: OutlineViewComponentProps) {
    super(props);
  }

  render(): ?React.Element<any> {
    const {outline, searchEnabled} = this.props;

    switch (outline.kind) {
      case 'empty':
      case 'not-text-editor':
        return (
          <EmptyState
            title="No outline available"
            message="You need to open a file to use outline view."
          />
        );
      case 'loading':
        return (
          <div className="nuclide-outline-view-loading">
            <LoadingSpinner
              className="inline-block"
              size={LoadingSpinnerSizes.MEDIUM}
            />
          </div>
        );
      case 'no-provider':
        return outline.grammar === 'Null Grammar'
          ? <EmptyState
              title="No outline available"
              message="The current file doesn't have an associated grammar. You may want to save it."
            />
          : <EmptyState
              title="No outline available"
              message={
                'Outline view does not currently support ' +
                outline.grammar +
                '.'
              }
            />;
      case 'provider-no-outline':
        return (
          <EmptyState
            title="No outline available"
            message="There are no outline providers registered."
          />
        );
      case 'outline':
        return (
          <OutlineViewCore outline={outline} searchEnabled={searchEnabled} />
        );
      default:
        (outline: empty);
    }
  }
}

type OutlineViewCoreProps = {
  outline: OutlineForUi,
  searchEnabled: boolean,
};

/**
 * Contains both the search field and the scrollable outline tree
 */
class OutlineViewCore extends React.PureComponent {
  props: OutlineViewCoreProps;
  state: {
    searchResults: Map<OutlineTreeForUi, SearchResult>,
  } = {
    searchResults: new Map(),
  };

  render() {
    const {outline, searchEnabled} = this.props;
    invariant(outline.kind === 'outline');

    return (
      <div className="nuclide-outline-view-core">
        {searchEnabled
          ? <OutlineViewSearchComponent
              outlineTrees={outline.outlineTrees}
              editor={outline.editor}
              updateSearchResults={searchResults => {
                this.setState({searchResults});
              }}
            />
          : null}
        <div className="nuclide-outline-view-trees-scroller">
          <div className="nuclide-outline-view-trees">
            {renderTrees(
              outline.editor,
              outline.outlineTrees,
              this.state.searchResults,
            )}
          </div>
        </div>
      </div>
    );
  }
}

class OutlineTree extends React.PureComponent {
  props: {
    editor: atom$TextEditor,
    outline: OutlineTreeForUi,
    searchResults: Map<OutlineTreeForUi, SearchResult>,
  };

  onClick = () => {
    const {editor, outline} = this.props;
    const pane = atom.workspace.paneForItem(editor);
    if (pane == null) {
      return;
    }
    analytics.track('atom-ide-outline-view:go-to-location');
    pane.activate();
    pane.activateItem(editor);
    goToLocationInEditor(
      editor,
      outline.startPosition.row,
      outline.startPosition.column,
    );
  };

  onDoubleClick = () => {
    const {editor, outline} = this.props;

    // Assumes that the click handler has already run, activating the text editor and moving the
    // cursor to the start of the symbol.
    const endPosition = outline.endPosition;
    if (endPosition != null) {
      editor.selectToBufferPosition(endPosition);
    }
  };

  render(): React.Element<any> {
    const {editor, outline, searchResults} = this.props;

    const classNames = ['list-nested-item'];
    if (outline.kind) {
      classNames.push(`kind-${outline.kind}`);
    }
    const classes = classnames(classNames, {
      selected: outline.highlighted,
    });
    return (
      <li className={classes}>
        <div
          className="list-item nuclide-outline-view-item"
          onClick={this.onClick}
          onDoubleClick={this.onDoubleClick}>
          {renderItem(outline, searchResults.get(outline))}
        </div>
        {renderTrees(editor, outline.children, searchResults)}
      </li>
    );
  }
}

function renderItem(
  outline: OutlineTreeForUi,
  searchResult: ?SearchResult,
): Array<React.Element<any> | string> {
  const r = [];
  const icon =
    // flowlint-next-line sketchy-null-string:off
    outline.icon || (outline.kind && OUTLINE_KIND_TO_ICON[outline.kind]);

  if (icon != null) {
    r.push(<span key={`icon-${icon}`} className={`icon icon-${icon}`} />);
    // Note: icons here are fixed-width, so the text lines up.
  }

  if (outline.tokenizedText != null) {
    let offset = 0;
    r.push(
      ...outline.tokenizedText.map((token, i) => {
        const toReturn = renderTextToken(token, i, searchResult, offset);
        offset += token.value.length;
        return toReturn;
      }),
    );
  } else if (outline.plainText != null) {
    const textWithMatching =
      searchResult && searchResult.matchingCharacters
        ? groupMatchIndexes(
            outline.plainText,
            searchResult.matchingCharacters,
            renderMatchedSubsequence,
            renderUnmatchedSubsequence,
          )
        : outline.plainText;
    r.push(...textWithMatching);
  } else {
    r.push('Missing text');
  }
  return r;
}

function renderTextToken(
  token: TextToken,
  index: number,
  searchResult: ?SearchResult,
  offset: number,
): React.Element<any> {
  const className = TOKEN_KIND_TO_CLASS_NAME_MAP[token.kind];
  return (
    <span className={className} key={index}>
      {searchResult && searchResult.matchingCharacters
        ? groupMatchIndexes(
            token.value,
            searchResult.matchingCharacters
              .map(el => el - offset)
              .filter(el => el >= 0 && el < token.value.length),
            renderMatchedSubsequence,
            renderUnmatchedSubsequence,
          )
        : token.value}
    </span>
  );
}

function renderSubsequence(seq: string, props: Object): React.Element<any> {
  return (
    <span {...props}>
      {seq}
    </span>
  );
}

function renderUnmatchedSubsequence(
  seq: string,
  key: number | string,
): React.Element<any> {
  return renderSubsequence(seq, {key});
}

function renderMatchedSubsequence(
  seq: string,
  key: number | string,
): React.Element<any> {
  return renderSubsequence(seq, {
    key,
    className: 'atom-ide-outline-view-match',
  });
}

function renderTrees(
  editor: atom$TextEditor,
  outlines: Array<OutlineTreeForUi>,
  searchResults: Map<OutlineTreeForUi, SearchResult>,
): ?React.Element<any> {
  if (outlines.length === 0) {
    return null;
  }
  return (
    // Add `position: relative;` to let `li.selected` style position itself relative to the list
    // tree rather than to its container.
    <ul
      className="list-tree"
      style={{
        position: 'relative',
      }}>
      {outlines.map((outline, index) => {
        const result = searchResults.get(outline);
        return !result || result.visible
          ? <OutlineTree
              editor={editor}
              outline={outline}
              key={index}
              searchResults={searchResults}
            />
          : null;
      })}
    </ul>
  );
}

const OUTLINE_KIND_TO_ICON = {
  array: 'type-array',
  boolean: 'type-boolean',
  class: 'type-class',
  constant: 'type-constant',
  constructor: 'type-constructor',
  enum: 'type-enum',
  field: 'type-field',
  file: 'type-file',
  function: 'type-function',
  interface: 'type-interface',
  method: 'type-method',
  module: 'type-module',
  namespace: 'type-namespace',
  number: 'type-number',
  package: 'type-package',
  property: 'type-property',
  string: 'type-string',
  variable: 'type-variable',
};
