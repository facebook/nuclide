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
import {
  ResizeSensitiveContainer,
} from '../../../nuclide-ui/ResizeSensitiveContainer';

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

  // This is a <List> from react-virtualized (untyped library)
  _hasher: Hasher<Record>;
  _list: ?React.Element<any>;
  _wrapper: ?HTMLElement;
  _renderedRecords: Map<Record, RecordView>;

  constructor(props: Props) {
    super(props);
    this._hasher = new Hasher();
    this._renderedRecords = new Map();
    (this: any)._getExecutor = this._getExecutor.bind(this);
    (this: any)._getProvider = this._getProvider.bind(this);
    (this: any)._getRowHeight = this._getRowHeight.bind(this);
    (this: any)._handleListRef = this._handleListRef.bind(this);
    (this: any)._handleTableWrapper = this._handleTableWrapper.bind(this);
    (this: any)._handleRecordHeightChange = this._handleRecordHeightChange.bind(
      this,
    );
    (this: any)._handleResize = this._handleResize.bind(this);
    (this: any)._onScroll = this._onScroll.bind(this);
    (this: any)._renderRow = this._renderRow.bind(this);
    this.state = {
      width: 0,
      height: 0,
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (
      this._list != null &&
      prevProps.displayableRecords.length !==
        this.props.displayableRecords.length
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
            />
          : null}
      </ResizeSensitiveContainer>
    );
  }

  scrollToBottom(): void {
    if (this._list != null) {
      // $FlowIgnore Untyped react-virtualized List method
      this._list.scrollToRow(this.props.displayableRecords.length - 1);
    }
  }

  _getExecutor(id: string): ?Executor {
    return this.props.getExecutor(id);
  }

  _getProvider(id: string): ?OutputProvider {
    return this.props.getProvider(id);
  }

  _renderRow(rowMetadata: RowRendererParams): React.Element<any> {
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
  }

  _containerRendered(): boolean {
    return this.state.width !== 0 && this.state.height !== 0;
  }

  _getRowHeight({index}: RowHeightParams): number {
    return this.props.displayableRecords[index].height;
  }

  _handleTableWrapper(tableWrapper: HTMLElement): void {
    this._wrapper = tableWrapper;
  }

  _handleListRef(listRef: React.Element<any>): void {
    this._list = listRef;
  }

  _handleResize(height: number, width: number): void {
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
  }

  _handleRecordHeightChange(recordId: number, newHeight: number): void {
    this.props.onDisplayableRecordHeightChange(recordId, newHeight, () => {
      // The react-virtualized List component is provided the row heights
      // through a function, so it has no way of knowing that a row's height
      // has changed unless we explicitly notify it to recompute the heights.
      if (this._list != null) {
        // $FlowIgnore Untyped react-virtualized List component method
        this._list.recomputeRowHeights();
      }
    });
  }

  _onScroll({clientHeight, scrollHeight, scrollTop}: OnScrollParams): void {
    this.props.onScroll(clientHeight, scrollHeight, scrollTop);
  }
}
