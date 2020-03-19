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

/* global performance, requestAnimationFrame */

import type {FileResults} from 'nuclide-commons/FileResults';

import escapeStringRegexp from 'escape-string-regexp';
import * as React from 'react';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {AtomInput} from './AtomInput';
import {Button} from './Button';
import {ButtonGroup} from './ButtonGroup';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import InfiniteLoader from 'react-virtualized/dist/commonjs/InfiniteLoader';
import List from 'react-virtualized/dist/commonjs/List';
import {
  CellMeasurer,
  CellMeasurerCache,
} from 'react-virtualized/dist/commonjs/CellMeasurer';
import FileResultsComponent from './FileResultsComponent';

// no-unused-state rule does not understand usages in callback-style setState.
/* eslint-disable react/no-unused-state */

const RENDER_BUFFER = 10;
const OPEN_ALL_PROMPT_LIMIT = 25;

type Props = {
  count: number,
  fileResultsCount: number,
  exceededByteLimit: boolean,
  loadResults: (offset: number, limit: number) => Promise<Array<FileResults>>,
  controlsVisible: boolean,
  onClick: (path: string, line?: number, column?: number) => mixed,
  onToggleControls: () => mixed,
  extraControls?: State => React.Node,
};

type State = {
  collapsed: Map<string, boolean>,
  collapseNew: boolean,
  grep: ?RegExp,
  grepInvert: boolean,
};

/**
 * Uses react-virtualized to display a lazily-rendered view of the search results.
 */
export default class ScrollableResults extends React.Component<Props, State> {
  disposables: UniversalDisposable;
  _listRef: ?List;
  _measurementCache: CellMeasurerCache;
  _loaderRef: ?InfiniteLoader;
  _loadedFiles: Array<FileResults> = [];

  // _loadMoreRows may be called multiple times by different parts of the
  // render lifecycle. Share it as a variable rather than in `state` so that
  // _loadMoreRows can be idempotent.
  _greppedIndex: number = 0;
  _shownResults: Array<FileResults> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      collapsed: new Map(),
      collapseNew: false,
      grep: null,
      grepInvert: false,
    };
    this.disposables = new UniversalDisposable();
    this._measurementCache = new CellMeasurerCache();
  }

  componentWillUnmount() {
    this.disposables.dispose();
  }

  _onToggle = (path: string, index: number) => {
    this.setState(
      ({collapsed}) => {
        const newCollapsed = new Map(collapsed);
        newCollapsed.set(path, !collapsed.get(path));
        return {collapsed: newCollapsed};
      },
      () => this._remeasure(index),
    );
  };

  _onGrepChange = (grep: string) => {
    // Smart-case: make it case sensitive if a capital letter is supplied.
    const flags = grep.toLocaleLowerCase() === grep ? 'i' : undefined;
    let grepRe = null;
    try {
      grepRe = grep === '' ? null : new RegExp(grep, flags);
    } catch (e) {
      grepRe = new RegExp(escapeStringRegexp(grep), flags);
    }
    this._greppedIndex = 0;
    this._shownResults = grepRe == null ? this._loadedFiles : [];
    this.setState({grep: grepRe}, () => this._refreshLoader());
  };

  _invertGrep = () => {
    this._greppedIndex = 0;
    this._shownResults = this.state.grep == null ? this._loadedFiles : [];
    this.setState(
      ({grepInvert}) => ({grepInvert: !grepInvert}),
      () => this._refreshLoader(),
    );
  };

  _collapseAll = () => {
    this.setState(
      {
        collapsed: new Map(this._loadedFiles.map(f => [f.path, true])),
        collapseNew: true,
      },
      () => this._remeasure(),
    );
  };

  _expandAll = () => {
    // This can only expand the height, so don't reflow.
    this.setState({collapsed: new Map(), collapseNew: false}, () =>
      this._remeasure(),
    );
  };

  _openAll = async () => {
    await this._loadUpToIndex(this.props.fileResultsCount - 1);
    this._openAllLoadedResults();
  };

  _loadUpToIndex = async (untilIndex: number) => {
    const currentLoaded = this._loadedFiles.length;
    const newResults = await this.props.loadResults(
      currentLoaded,
      untilIndex - currentLoaded + 1,
    );
    if (this._loadedFiles.length !== currentLoaded) {
      // It's possible that another call to _loadUpToIndex completed first
      // if `_openAll` competes with  `_loadMoreRows`.
      // In this case just retry the request.
      return this._loadUpToIndex(untilIndex);
    } else {
      this._loadedFiles.push(...newResults);
      this.setState(({collapsed, collapseNew}) => ({
        collapsed: newResults.reduce(
          (accumulator, newResult) =>
            accumulator.set(newResult.path, collapseNew),
          new Map(collapsed),
        ),
      }));
      return newResults;
    }
  };

  _openAllLoadedResults = () => {
    const files = this._loadedFiles
      .map(file => {
        if (this.state.grep == null) {
          return {
            path: file.path,
            row: file.groups[0].matches[0].start.row,
            column: file.groups[0].matches[0].start.column,
          };
        }
        const grepResults = file.applyGrep(
          this.state.grep,
          this.state.grepInvert,
        );
        if (grepResults == null) {
          return null;
        }
        // Groups may be [] if only the path matched an inverted filter.
        if (grepResults.pathMatch != null || grepResults.groups.length === 0) {
          return {
            path: file.path,
            row: undefined,
            column: undefined,
          };
        }
        return {
          path: file.path,
          row: grepResults.groups[0].matches[0].start.row,
          column: grepResults.groups[0].matches[0].start.column,
        };
      })
      .filter(Boolean);
    if (files.length > OPEN_ALL_PROMPT_LIMIT) {
      if (
        atom.confirm({
          message: `This will open ${files.length} files. Are you sure?`,
          buttons: ['OK', 'Cancel'],
        }) !== 0
      ) {
        return;
      }
    }
    // Open the first match for every file.
    files.forEach(file => {
      this.props.onClick(file.path, file.row, file.column);
    });
  };

  _getSummaryText() {
    if (this.state.grep != null) {
      return (
        `Only showing results ${
          this.state.grepInvert ? 'not' : ''
        } matching regex: ` + this.state.grep.source
      );
    }
    if (this.props.exceededByteLimit) {
      return (
        <span className="warning">
          Results exceeded byte-size limit. Only displaying the first{' '}
          {this.props.count} results.
        </span>
      );
    }
    return `${this.props.count} result(s) found in ${
      this.props.fileResultsCount
    } file(s).`;
  }

  _setListRef = (list: ?List) => {
    this._listRef = list;
  };

  _setLoaderRef = (loader: ?InfiniteLoader) => {
    this._loaderRef = loader;
  };

  _refreshLoader() {
    if (this._loaderRef != null) {
      this._loaderRef.resetLoadMoreRowsCache(true);
    }
    this._remeasure();
  }

  _remeasure(index?: number) {
    if (this._listRef != null) {
      this._listRef.recomputeRowHeights(index);
    }
    if (index == null) {
      this._measurementCache.clearAll();
    } else {
      this._measurementCache.clear(index);
    }
  }

  _isRowLoaded = ({index}: {index: number}) => {
    return index < this._shownResults.length;
  };

  // False positive -- `stopIndex` is used here, and this isn't a component.
  // eslint-disable-next-line react/no-unused-prop-types
  _loadMoreRows = async ({stopIndex}: {stopIndex: number}) => {
    const {grep, grepInvert} = this.state;
    if (grep == null) {
      const newResults = await this._loadUpToIndex(stopIndex);
      this._shownResults.push(...newResults);
      // Trigger a re-render (since we mutated shownResults directly.)
      this.forceUpdate();
      return;
    }
    const yieldAnimationFrame = async () => {
      await new Promise(requestAnimationFrame);
      // Due to the 'await' it's possible that another grep started.
      // Return false so that the caller can stop.
      return (
        !this.disposables.disposed &&
        this.state.grep === grep &&
        this.state.grepInvert === grepInvert
      );
    };
    let startTime = performance.now();
    while (
      this._greppedIndex < this.props.fileResultsCount &&
      this._shownResults.length < stopIndex + 1
    ) {
      if (this._loadedFiles.length <= this._greppedIndex) {
        // eslint-disable-next-line no-await-in-loop
        await this._loadUpToIndex(this._greppedIndex + RENDER_BUFFER);
      }
      const currentFile = this._loadedFiles[this._greppedIndex];
      const fileResults = currentFile.applyGrep(grep, grepInvert);
      this._greppedIndex++;
      if (fileResults != null) {
        // Copying this list is too expensive, so just mutate it.
        this._shownResults.push(fileResults);
      }
      // Yield the event loop if we've spent too long grepping results (10ms).
      if (performance.now() - startTime > 10) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await yieldAnimationFrame())) {
          return;
        }
        startTime = performance.now();
      }
    }
    // Always yield the event loop at least once per loadMoreRows() call.
    // (since InfiniteLoader may end up chaining them.)
    if (!(await yieldAnimationFrame())) {
      return;
    }
    // Trigger a re-render (since we mutated shownResults directly.)
    this.forceUpdate();
  };

  _getRowCount() {
    if (this.state.grep == null) {
      return this.props.fileResultsCount;
    }
    // We don't know how many results there will be.
    // Tell InfiniteLoader we have RENDER_BUFFER more, so that
    // it will try to load at least that many more rows.
    return this._shownResults.length + RENDER_BUFFER;
  }

  _renderRow = (props: {
    index: number,
    key: number,
    parent: React.Node,
    style: Object,
  }) => {
    const {key, parent, index, style} = props;
    if (!this._isRowLoaded(props)) {
      return null;
    }
    const fileResults = this._shownResults[index];
    return (
      <CellMeasurer
        cache={this._measurementCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}>
        <div style={style} className="scrollable-search-results-item">
          {index === 0 && (
            <div className="scrollable-search-results-summary">
              {this._getSummaryText()}
            </div>
          )}
          <FileResultsComponent
            fileResults={fileResults}
            collapsed={this.state.collapsed.get(fileResults.path) === true}
            onClick={this.props.onClick}
            onToggle={path => this._onToggle(path, index)}
          />
        </div>
      </CellMeasurer>
    );
  };

  render(): React.Node {
    const rowCount = this._getRowCount();
    return (
      <div className="scrollable-search-results-wrapper">
        <div className="scrollable-search-results-controls">
          {this.props.controlsVisible ? (
            <div className="scrollable-search-results-controls-form">
              <div style={{flex: 1}} className="scrollable-controls-block">
                <div className="scrollable-controls-label">Filter:</div>
                <AtomInput
                  autofocus={true}
                  size="sm"
                  initialValue={
                    this.state.grep != null ? this.state.grep.source : ''
                  }
                  onDidChange={this._onGrepChange}
                  placeholderText="Additional grep filter..."
                />
                <Button
                  className="scrollable-search-results-controls-button"
                  selected={this.state.grepInvert}
                  onClick={this._invertGrep}>
                  Invert
                </Button>
              </div>
              <div className="scrollable-controls-block">
                <ButtonGroup>
                  <Button onClick={this._collapseAll}>Collapse All</Button>
                  <Button onClick={this._expandAll}>Expand All</Button>
                </ButtonGroup>
                <Button
                  className="scrollable-search-results-controls-button"
                  onClick={this._openAll}>
                  Open All
                </Button>
                {this.props.extraControls != null
                  ? this.props.extraControls(this.state)
                  : null}
              </div>
              <Button
                className="scrollable-search-results-controls-toggle icon icon-chevron-up"
                onClick={this.props.onToggleControls}
                tooltip={{title: 'Hide Controls', delay: 100}}
              />
            </div>
          ) : (
            <Button
              className="scrollable-search-results-controls-toggle-hidden icon icon-chevron-down"
              onClick={this.props.onToggleControls}
            />
          )}
        </div>
        <div
          // Magic incantations to make interior text copyable.
          className="scrollable-search-results native-key-bindings"
          tabIndex={-1}
          style={{WebkitUserSelect: 'text'}}>
          <InfiniteLoader
            ref={this._setLoaderRef}
            isRowLoaded={this._isRowLoaded}
            loadMoreRows={this._loadMoreRows}
            rowCount={rowCount}>
            {({onRowsRendered, registerChild}) => (
              <AutoSizer>
                {({width, height}) => (
                  <List
                    // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
                    ref={list => {
                      this._setListRef(list);
                      registerChild(list);
                    }}
                    onRowsRendered={onRowsRendered}
                    overscanRowCount={RENDER_BUFFER}
                    rowCount={rowCount}
                    rowHeight={this._measurementCache.rowHeight}
                    rowRenderer={this._renderRow}
                    width={width}
                    height={height}
                  />
                )}
              </AutoSizer>
            )}
          </InfiniteLoader>
        </div>
      </div>
    );
  }
}
