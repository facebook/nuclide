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

import * as React from 'react';
import invariant from 'assert';
import classnames from 'classnames';

import analytics from 'nuclide-commons-atom/analytics';
import {
  goToLocation,
  goToLocationInEditor,
} from 'nuclide-commons-atom/go-to-location';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';
import {EmptyState} from 'nuclide-commons-ui/EmptyState';
import {NestedTreeItem, Tree, TreeItem} from 'nuclide-commons-ui/Tree';

import type {SearchResult} from './OutlineViewSearch';
import {OutlineViewSearchComponent} from './OutlineViewSearch';
import groupMatchIndexes from 'nuclide-commons/groupMatchIndexes';

type State = {
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  outline: OutlineForUi,
};

type Props = {
  outlines: Observable<OutlineForUi>,
  visibility: Observable<boolean>,
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

export class OutlineView extends React.PureComponent<Props, State> {
  subscription: ?UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {
      fontFamily: (atom.config.get('editor.fontFamily'): any),
      fontSize: (atom.config.get('editor.fontSize'): any),
      lineHeight: (atom.config.get('editor.lineHeight'): any),
      outline: {
        kind: 'empty',
      },
    };
  }

  componentDidMount(): void {
    invariant(this.subscription == null);
    this.subscription = new UniversalDisposable(
      this.props.outlines.subscribe(outline => {
        this.setState({outline});
      }),
      atom.config.observe('editor.fontSize', (size: mixed) => {
        this.setState({fontSize: (size: any)});
      }),
      atom.config.observe('editor.fontFamily', (font: mixed) => {
        this.setState({fontFamily: (font: any)});
      }),
      atom.config.observe('editor.lineHeight', (size: mixed) => {
        this.setState({lineHeight: (size: any)});
      }),
    );
  }

  componentWillUnmount(): void {
    invariant(this.subscription != null);
    this.subscription.unsubscribe();
    this.subscription = null;
  }

  render(): React.Node {
    return (
      <div className="outline-view">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .outline-view-core {
                line-height: ${this.state.lineHeight};
                font-size: ${this.state.fontSize}px;
                font-family: ${this.state.fontFamily};
              }
          `,
          }}
        />
        <OutlineViewComponent
          outline={this.state.outline}
          visibility={this.props.visibility}
        />
      </div>
    );
  }
}

type OutlineViewComponentProps = {
  outline: OutlineForUi,
  visibility: Observable<boolean>,
};

class OutlineViewComponent extends React.PureComponent<
  OutlineViewComponentProps,
> {
  constructor(props: OutlineViewComponentProps) {
    super(props);
  }

  render(): React.Node {
    const {outline} = this.props;

    switch (outline.kind) {
      case 'empty':
      case 'not-text-editor':
        return (
          <EmptyState
            title="No outline available"
            message="Open a file to see its outline."
          />
        );
      case 'loading':
        return (
          <div className="outline-view-loading">
            <LoadingSpinner
              className="inline-block"
              size={LoadingSpinnerSizes.MEDIUM}
            />
          </div>
        );
      case 'no-provider':
        return outline.grammar === 'Null Grammar' ? (
          <EmptyState
            title="No outline available"
            message="Atom doesn't recognize this file's language. Make sure this file has an extension and has been saved."
          />
        ) : (
          <EmptyState
            title="No outline available"
            message={
              <div>
                {outline.grammar} files do not currently support outlines.{' '}
                <a
                  href="#"
                  onClick={() =>
                    goToLocation(
                      `atom://config/install/package:ide-${outline.grammar}`,
                    )}>
                  Install an IDE package first.
                </a>
              </div>
            }
          />
        );
      case 'provider-no-outline':
        return (
          <EmptyState
            title="No outline available"
            message="This is likely an error with the language package."
          />
        );
      case 'outline':
        return (
          <OutlineViewCore
            outline={outline}
            visibility={this.props.visibility}
          />
        );
      default:
        (outline: empty);
    }
  }
}

type OutlineViewCoreProps = {
  outline: OutlineForUi,
  visibility: Observable<boolean>,
};

/**
 * Contains both the search field and the scrollable outline tree
 */
class OutlineViewCore extends React.PureComponent<
  OutlineViewCoreProps,
  {
    searchResults: Map<OutlineTreeForUi, SearchResult>,
  },
> {
  state: {
    searchResults: Map<OutlineTreeForUi, SearchResult>,
  } = {
    searchResults: new Map(),
  };

  render() {
    const {outline, visibility} = this.props;
    invariant(outline.kind === 'outline');

    return (
      <div className="outline-view-core">
        <OutlineViewSearchComponent
          outlineTrees={outline.outlineTrees}
          editor={outline.editor}
          updateSearchResults={searchResults => {
            this.setState({searchResults});
          }}
          visibility={visibility}
        />
        <div className="outline-view-trees-scroller">
          <Tree className="outline-view-trees">
            {renderTrees(
              outline.editor,
              outline.outlineTrees,
              this.state.searchResults,
            )}
          </Tree>
        </div>
      </div>
    );
  }
}

class OutlineTree extends React.PureComponent<{
  editor: atom$TextEditor,
  outline: OutlineTreeForUi,
  searchResults: Map<OutlineTreeForUi, SearchResult>,
}> {
  _handleSelect = () => {
    const {editor, outline} = this.props;
    // single click moves the cursor, but does not focus the editor
    analytics.track('atom-ide-outline-view:go-to-location');
    const landingPosition =
      outline.landingPosition != null
        ? outline.landingPosition
        : outline.startPosition;
    goToLocationInEditor(editor, {
      line: landingPosition.row,
      column: landingPosition.column,
    });
  };

  _handleConfirm = () => {
    this._focusEditor();
  };

  _handleTripleClick = () => {
    const {editor, outline} = this.props;
    // triple click selects the symbol's region
    const endPosition = outline.endPosition;
    if (endPosition != null) {
      editor.selectToBufferPosition(endPosition);
    }
    this._focusEditor();
  };

  _focusEditor = () => {
    const {editor} = this.props;
    // double and triple clicks focus the editor afterwards
    const pane = atom.workspace.paneForItem(editor);
    if (pane == null) {
      return;
    }

    // Assumes that the click handler has already run, which moves the
    // cursor to the start of the symbol. Let's activate the pane now.
    pane.activate();
    pane.activateItem(editor);
  };

  render(): React.Node {
    const {editor, outline, searchResults} = this.props;

    const classes = classnames(
      'outline-view-item',
      outline.kind ? `kind-${outline.kind}` : null,
      {
        selected: outline.highlighted,
      },
    );

    const childTrees = renderTrees(editor, outline.children, searchResults);
    const itemContent = renderItem(outline, searchResults.get(outline));

    if (childTrees.length === 0) {
      return (
        <TreeItem
          className={classes}
          onConfirm={this._handleConfirm}
          onSelect={this._handleSelect}
          onTripleClick={this._handleTripleClick}>
          {itemContent}
        </TreeItem>
      );
    }
    return (
      // Set fontSize for the li to make the highlighted region of selected
      // lines (set equal to 2em) look reasonable relative to size of the font.
      <NestedTreeItem
        className={classes}
        onConfirm={this._handleConfirm}
        onSelect={this._handleSelect}
        onTripleClick={this._handleTripleClick}
        title={itemContent}>
        {childTrees}
      </NestedTreeItem>
    );
  }
}

function renderItem(
  outline: OutlineTreeForUi,
  searchResult: ?SearchResult,
): React.Element<string> | string {
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

  return <span>{r}</span>;
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
  return <span {...props}>{seq}</span>;
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
    className: 'outline-view-match',
  });
}

function renderTrees(
  editor: atom$TextEditor,
  outlines: Array<OutlineTreeForUi>,
  searchResults: Map<OutlineTreeForUi, SearchResult>,
): Array<?React.Element<any>> {
  return outlines.map((outline, index) => {
    const result = searchResults.get(outline);
    return !result || result.visible ? (
      <OutlineTree
        editor={editor}
        outline={outline}
        key={index}
        searchResults={searchResults}
      />
    ) : null;
  });
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
