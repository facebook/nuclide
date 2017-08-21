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

import type {
  DisplayableRecord,
  Executor,
  OutputProvider,
  Record,
  RecordHeightChangeHandler,
} from '../types';

import Hasher from 'nuclide-commons/Hasher';
import React from 'react';
import {List} from 'react-virtualized';
import RecordView from './RecordView';
import recordsChanged from '../recordsChanged';
import {ResizeSensitiveContainer} from '../../../nuclide-ui/ResizeSensitiveContainer';

type Props = {
  displayableRecords: Array<DisplayableRecord>,
  showSourceLabels: boolean,
  getExecutor: (id: string) => ?Executor,
  getProvider: (id: string) => ?OutputProvider,
  onScroll: (
    offsetHeight: number,
    scrollHeight: number,
    scrollTop: number,
  ) => void,
  onDisplayableRecordHeightChange: RecordHeightChangeHandler,
};

type State = {
  width: number,
  height: number,
};

type RowRendererParams = {
  index: number,
  key: string,
  style: Object,
  isScrolling: boolean,
};

type RowHeightParams = {
  index: number,
};

type OnScrollParams = {
  clientHeight: number,
  scrollHeight: number,
  scrollTop: number,
};

// The number of extra rows to render beyond what is visible
const OVERSCAN_COUNT = 5;

export default class OutputTable extends React.Component {
  props: Props;
  state: State;

  _hasher: Hasher<Record>;
  // This is a <List> from react-virtualized (untyped library)
  _list: ?React.Element<any>;
  _wrapper: ?HTMLElement;
  _renderedRecords: Map<Record, RecordView>;

  // The currently rendered range.
  _startIndex: number;
  _stopIndex: number;

  constructor(props: Props) {
    super(props);
    this._hasher = new Hasher();
    this._renderedRecords = new Map();
    this.state = {
      width: 0,
      height: 0,
    };
    this._startIndex = 0;
    this._stopIndex = 0;
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (
      this._list != null &&
      recordsChanged(
        prevProps.displayableRecords,
        this.props.displayableRecords,
      )
    ) {
      // $FlowIgnore Untyped react-virtualized List method
      this._list.recomputeRowHeights();
    }
  }

  render(): ?React.Element<any> {
    return (
      <ResizeSensitiveContainer
        className="nuclide-console-table-wrapper native-key-bindings"
        onResize={this._handleResize}
        tabIndex="1">
        {this._containerRendered()
          ? <List
              ref={this._handleListRef}
              height={this.state.height}
              width={this.state.width}
              rowCount={this.props.displayableRecords.length}
              rowHeight={this._getRowHeight}
              rowRenderer={this._renderRow}
              overscanRowCount={OVERSCAN_COUNT}
              onScroll={this._onScroll}
              onRowsRendered={this._handleListRender}
            />
          : null}
      </ResizeSensitiveContainer>
    );
  }

  _handleListRender = (opts: {startIndex: number, stopIndex: number}): void => {
    this._startIndex = opts.startIndex;
    this._stopIndex = opts.stopIndex;
  };

  scrollToBottom(): void {
    if (this._list != null) {
      // $FlowIgnore Untyped react-virtualized List method
      this._list.scrollToRow(this.props.displayableRecords.length - 1);
    }
  }

  _getExecutor = (id: string): ?Executor => {
    return this.props.getExecutor(id);
  };

  _getProvider = (id: string): ?OutputProvider => {
    return this.props.getProvider(id);
  };

  _renderRow = (rowMetadata: RowRendererParams): React.Element<any> => {
    const {index, style} = rowMetadata;
    const displayableRecord = this.props.displayableRecords[index];
    const {record} = displayableRecord;
    return (
      <div
        key={this._hasher.getHash(displayableRecord.record)}
        className="nuclide-console-table-row-wrapper"
        style={style}>
        <RecordView
          ref={(view: ?RecordView) => {
            if (view != null) {
              this._renderedRecords.set(record, view);
            } else {
              this._renderedRecords.delete(record);
            }
          }}
          getExecutor={this._getExecutor}
          getProvider={this._getProvider}
          displayableRecord={displayableRecord}
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
    return this.props.displayableRecords[index].height;
  };

  _handleTableWrapper = (tableWrapper: HTMLElement): void => {
    this._wrapper = tableWrapper;
  };

  _handleListRef = (listRef: React.Element<any>): void => {
    this._list = listRef;
  };

  _handleResize = (height: number, width: number): void => {
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

  _handleRecordHeightChange = (recordId: number, newHeight: number): void => {
    this.props.onDisplayableRecordHeightChange(recordId, newHeight, () => {
      // The react-virtualized List component is provided the row heights
      // through a function, so it has no way of knowing that a row's height
      // has changed unless we explicitly notify it to recompute the heights.
      if (this._list == null) {
        return;
      }
      // $FlowIgnore Untyped react-virtualized List component method
      this._list.recomputeRowHeights();

      // If the element in the viewport when its height changes, scroll to ensure that the entirety
      // of the record is in the viewport. This is important not just for if the last record changes
      // height through user interaction (e.g. expanding a debugger variable), but also because this
      // is the mechanism through which the record's true initial height is reported. Therefore, we
      // may have scrolled to the bottom, and only afterwards received its true height. In this
      // case, it's important that we then scroll to the new bottom.
      const index = this.props.displayableRecords.findIndex(
        record => record.id === recordId,
      );
      if (index >= this._startIndex && index <= this._stopIndex) {
        // $FlowIgnore Untyped react-virtualized List component method
        this._list.scrollToRow(index);
      }
    });
  };

  _onScroll = ({
    clientHeight,
    scrollHeight,
    scrollTop,
  }: OnScrollParams): void => {
    this.props.onScroll(clientHeight, scrollHeight, scrollTop);
  };
}
