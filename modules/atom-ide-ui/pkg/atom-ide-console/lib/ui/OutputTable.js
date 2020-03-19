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

import type {Executor, Record, SourceInfo} from '../types';

import {DefaultWeakMap} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullThrows from 'nullthrows';
import {ResizeObservable} from 'nuclide-commons-ui/observable-dom';
import Hasher from 'nuclide-commons/Hasher';
import * as React from 'react';
import List from 'react-virtualized/dist/commonjs/List';
import {Subject} from 'rxjs';
import RecordView from './RecordView';
import recordsChanged from '../recordsChanged';

type Props = {|
  records: Array<Record>,
  showSourceLabels: boolean,
  fontSize: number,
  getExecutor: (id: string) => ?Executor,
  getProvider: (id: string) => ?SourceInfo,
  onScroll: (
    offsetHeight: number,
    scrollHeight: number,
    scrollTop: number,
  ) => void,
  shouldScrollToBottom: () => boolean,
|};

type State = {|
  width: number,
  height: number,
|};

type RowRendererParams = {|
  index: number,
  key: string,
  style: Object,
  isScrolling: boolean,
|};

type RowHeightParams = {|
  // These are not props to a component
  // eslint-disable-next-line react/no-unused-prop-types
  index: number,
|};

/* eslint-disable react/no-unused-prop-types */
type OnScrollParams = {|
  clientHeight: number,
  scrollHeight: number,
  scrollTop: number,
|};
/* eslint-enable react/no-unused-prop-types */

// The number of extra rows to render beyond what is visible
const OVERSCAN_COUNT = 5;
const INITIAL_RECORD_HEIGHT = 21;

export default class OutputTable extends React.Component<Props, State> {
  _disposable: UniversalDisposable;
  _hasher: Hasher<Record>;
  // This is a <List> from react-virtualized (untyped library)
  _list: ?React.Element<any>;
  _wrapper: ?HTMLElement;
  _renderedRecords: Map<Record, RecordView> = new Map();

  // The currently rendered range.
  _startIndex: number;
  _stopIndex: number;
  _refs: Subject<?HTMLElement>;
  _heights: DefaultWeakMap<Record, number> = new DefaultWeakMap(
    () => INITIAL_RECORD_HEIGHT,
  );
  // ExpressionTreeComponent expects an expansionStateId which is a stable
  // object instance across renders, but is unique across consoles. We
  // technically support multiple consoles in the UI, so here we ensure these
  // references are local to the OutputTable instance.
  _expansionStateIds: DefaultWeakMap<Record, Object> = new DefaultWeakMap(
    () => ({}),
  );
  _heightChanges: Subject<null> = new Subject();

  constructor(props: Props) {
    super(props);
    this._disposable = new UniversalDisposable();
    this._hasher = new Hasher();
    this.state = {
      width: 0,
      height: 0,
    };
    this._startIndex = 0;
    this._stopIndex = 0;
    this._refs = new Subject();
    this._disposable.add(
      this._heightChanges.subscribe(() => {
        // Theoretically we should be able to (trailing) throttle this to once
        // per render/paint using microtask, but I haven't been able to get it
        // to work without seeing visible flashes of collapsed output.
        this._recomputeRowHeights();
      }),
      this._refs
        .filter(Boolean)
        .switchMap(node => new ResizeObservable(nullThrows(node)).mapTo(node))
        .subscribe(node => {
          const {offsetHeight, offsetWidth} = nullThrows(node);
          this._handleResize(offsetHeight, offsetWidth);
        }),
    );
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (
      this._list != null &&
      recordsChanged(prevProps.records, this.props.records)
    ) {
      // $FlowIgnore Untyped react-virtualized List method
      this._list.recomputeRowHeights();
    }
    if (prevProps.fontSize !== this.props.fontSize) {
      this._renderedRecords.forEach(recordView =>
        recordView.measureAndNotifyHeight(),
      );
    }
  }

  componentWillUnmount() {
    this._disposable.dispose();
  }

  _handleRef = (node: ?HTMLElement) => {
    this._refs.next(node);
  };

  render(): React.Node {
    return (
      <div className="console-table-wrapper" ref={this._handleRef} tabIndex="1">
        {this._containerRendered() ? (
          <List
            // $FlowFixMe(>=0.53.0) Flow suppress
            ref={this._handleListRef}
            height={this.state.height}
            width={this.state.width}
            rowCount={this.props.records.length}
            rowHeight={this._getRowHeight}
            rowRenderer={this._renderRow}
            overscanRowCount={OVERSCAN_COUNT}
            onScroll={this._onScroll}
            onRowsRendered={this._handleListRender}
          />
        ) : null}
      </div>
    );
  }

  _recomputeRowHeights = () => {
    // The react-virtualized List component is provided the row heights
    // through a function, so it has no way of knowing that a row's height
    // has changed unless we explicitly notify it to recompute the heights.
    if (this._list == null) {
      return;
    }
    // $FlowIgnore Untyped react-virtualized List component method
    this._list.recomputeRowHeights();

    // If we are already scrolled to the bottom, scroll to ensure that the scrollbar remains at
    // the bottom. This is important not just for if the last record changes height through user
    // interaction (e.g. expanding a debugger variable), but also because this is the mechanism
    // through which the record's true initial height is reported. Therefore, we may have scrolled
    // to the bottom, and only afterwards received its true height. In this case, it's important
    // that we then scroll to the new bottom.
    if (this.props.shouldScrollToBottom()) {
      this.scrollToBottom();
    }
  };

  _handleListRender = (opts: {startIndex: number, stopIndex: number}): void => {
    this._startIndex = opts.startIndex;
    this._stopIndex = opts.stopIndex;
  };

  scrollToBottom(): void {
    if (this._list != null) {
      // $FlowIgnore Untyped react-virtualized List method
      this._list.scrollToRow(this.props.records.length - 1);
    }
  }

  _getExecutor = (id: string): ?Executor => {
    return this.props.getExecutor(id);
  };

  _getProvider = (id: string): ?SourceInfo => {
    return this.props.getProvider(id);
  };

  _renderRow = (rowMetadata: RowRendererParams): React.Element<any> => {
    const {index, style} = rowMetadata;
    const record = this.props.records[index];
    const key =
      record.messageId != null
        ? `messageId:${record.messageId}`
        : `recordHash:${this._hasher.getHash(record)}`;

    return (
      <div key={key} className="console-table-row-wrapper" style={style}>
        <RecordView
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={(view: ?RecordView) => {
            if (view != null) {
              this._renderedRecords.set(record, view);
            } else {
              this._renderedRecords.delete(record);
            }
          }}
          getExecutor={this._getExecutor}
          getProvider={this._getProvider}
          record={record}
          expansionStateId={this._expansionStateIds.get(record)}
          showSourceLabel={this.props.showSourceLabels}
          onHeightChange={this._handleRecordHeightChange}
        />
      </div>
    );
  };

  _containerRendered(): boolean {
    return this.state.width !== 0 && this.state.height !== 0;
  }

  _getRowHeight = ({index}: RowHeightParams): number => {
    return this._heights.get(this.props.records[index]);
  };

  _handleTableWrapper = (tableWrapper: HTMLElement): void => {
    this._wrapper = tableWrapper;
  };

  _handleListRef = (listRef: React.Element<any>): void => {
    const previousValue = this._list;
    this._list = listRef;

    // The child rows render before this ref gets set. So, if we are coming from
    // a state where the ref was null, we should ensure we notify
    // react-virtualized that we have measurements.
    if (previousValue == null && this._list != null) {
      this._heightChanges.next(null);
    }
  };

  _handleResize = (height: number, width: number): void => {
    if (height === this.state.height && width === this.state.width) {
      return;
    }
    this.setState({
      width,
      height,
    });

    // When this component resizes, the inner records will
    // also resize and potentially have their heights change
    // So we measure all of their heights again here
    this._renderedRecords.forEach(recordView =>
      recordView.measureAndNotifyHeight(),
    );
  };

  _handleRecordHeightChange = (record: Record, newHeight: number): void => {
    const oldHeight = this._heights.get(record);
    if (oldHeight !== newHeight) {
      this._heights.set(record, newHeight);
      this._heightChanges.next(null);
    }
  };

  _onScroll = ({
    clientHeight,
    scrollHeight,
    scrollTop,
  }: OnScrollParams): void => {
    this.props.onScroll(clientHeight, scrollHeight, scrollTop);
  };
}
