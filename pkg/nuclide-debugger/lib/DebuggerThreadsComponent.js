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

import * as React from 'react';
import ReactDOM from 'react-dom';
import type {ThreadItem} from './types';
import type Bridge from './Bridge';
import type ThreadStore from './ThreadStore';
import type {ThreadColumn} from '../../nuclide-debugger-base/lib/types';
import {Icon} from 'nuclide-commons-ui/Icon';
import {Table} from 'nuclide-commons-ui/Table';
import type {Row} from 'nuclide-commons-ui/Table';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';
import debounce from 'nuclide-commons/debounce';
import {scrollIntoViewIfNeeded} from 'nuclide-commons-ui/scrollIntoView';

type Props = {|
  +bridge: Bridge,
  +threadStore: ThreadStore,
  +customThreadColumns: Array<ThreadColumn>,
  +threadName: string,
|};

type State = {
  threadList: Array<ThreadItem>,
  selectedThreadId: number,
  sortedColumn: ?ColumnName,
  sortDescending: boolean,
  threadsLoading: boolean,
};

type ColumnName = $Keys<ThreadItem>; // & 'isSelected';
type CellData = ThreadItem & {isSelected: boolean};

const activeThreadIndicatorComponent = (props: {cellData: boolean}) => (
  <div className="nuclide-debugger-thread-list-item-current-indicator">
    {props.cellData ? (
      <Icon icon="arrow-right" title="Selected Thread" />
    ) : null}
  </div>
);

export class DebuggerThreadsComponent extends React.Component<Props, State> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    (this: any)._handleThreadStoreChanged = debounce(
      this._handleThreadStoreChanged,
      150,
    );

    this._disposables = new UniversalDisposable();
    this.state = {
      threadList: props.threadStore.getThreadList(),
      selectedThreadId: props.threadStore.getSelectedThreadId(),
      sortedColumn: null,
      sortDescending: false,
      threadsLoading: false,
    };
  }

  componentDidMount(): void {
    const {threadStore} = this.props;
    this._disposables.add(
      threadStore.onChange(() => this._handleThreadStoreChanged()),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate() {
    // Ensure the selected thread is scrolled into view.
    this._scrollSelectedThreadIntoView();
  }

  _scrollSelectedThreadIntoView(): void {
    const listNode = ReactDOM.findDOMNode(this.refs.threadTable);
    if (listNode) {
      const selectedRows =
        // $FlowFixMe
        listNode.getElementsByClassName(
          'nuclide-debugger-thread-list-item-selected',
        );

      if (selectedRows && selectedRows.length > 0) {
        scrollIntoViewIfNeeded(selectedRows[0], false);
      }
    }
  }

  _handleThreadStoreChanged(): void {
    this.setState({
      threadList: this.props.threadStore.getThreadList(),
      selectedThreadId: this.props.threadStore.getSelectedThreadId(),
      threadsLoading: this.props.threadStore.getThreadsReloading(),
    });
  }

  _handleSelectThread = (data: ThreadItem): void => {
    this.props.bridge.selectThread(data.id);
  };

  _handleSort = (sortedColumn: ?ColumnName, sortDescending: boolean): void => {
    this.setState({sortedColumn, sortDescending});
  };

  _sortRows = (
    threads: Array<Row<CellData>>,
    sortedColumnName: ?ColumnName,
    sortDescending: boolean,
  ): Array<Row<CellData>> => {
    if (sortedColumnName == null) {
      return threads;
    }

    // Use a numerical comparison for the ID column, string compare for all the others.
    const compare: any =
      sortedColumnName.toLowerCase() === 'id'
        ? (a: ?number, b: ?number, isAsc: boolean): number => {
            const cmp = (a || 0) - (b || 0);
            return isAsc ? cmp : -cmp;
          }
        : (a: string, b: string, isAsc: boolean): number => {
            const cmp = a.toLowerCase().localeCompare(b.toLowerCase());
            return isAsc ? cmp : -cmp;
          };

    const getter = row => row.data[sortedColumnName];
    return [...threads].sort((a, b) => {
      return compare(getter(a), getter(b), !sortDescending);
    });
  };

  render(): React.Node {
    const {threadList, selectedThreadId} = this.state;
    const activeThreadCol = {
      component: activeThreadIndicatorComponent,
      title: '',
      key: 'isSelected',
      width: 0.05,
    };

    const defaultColumns = [
      activeThreadCol,
      {
        title: 'ID',
        key: 'id',
        width: 0.15,
      },
      {
        title: 'Address',
        key: 'address',
        width: 0.55,
      },
      {
        title: 'Stop Reason',
        key: 'stopReason',
        width: 0.25,
      },
    ];

    // Individual debuggers can override the displayed columns.
    const columns =
      this.props.customThreadColumns.length === 0
        ? defaultColumns
        : [activeThreadCol, ...this.props.customThreadColumns];
    const threadName = this.props.threadName.toLowerCase();
    const emptyComponent = () => (
      <div className="nuclide-debugger-thread-list-empty">
        {threadList == null
          ? `(${threadName} unavailable)`
          : `no ${threadName} to display`}
      </div>
    );
    const rows =
      threadList == null
        ? []
        : threadList.map((threadItem, i) => {
            const cellData = {
              data: {
                ...threadItem,
                isSelected: Number(threadItem.id) === selectedThreadId,
              },
            };
            if (Number(threadItem.id) === selectedThreadId) {
              // $FlowIssue className is an optional property of a table row
              cellData.className = 'nuclide-debugger-thread-list-item-selected';
            }
            return cellData;
          });

    if (this.state.threadsLoading) {
      return (
        <div
          className="nuclide-debugger-thread-loading"
          title="Loading threads...">
          <LoadingSpinner size={LoadingSpinnerSizes.MEDIUM} />
        </div>
      );
    }

    return (
      <Table
        columns={columns}
        emptyComponent={emptyComponent}
        rows={this._sortRows(
          rows,
          this.state.sortedColumn,
          this.state.sortDescending,
        )}
        selectable={true}
        resizable={true}
        onSelect={this._handleSelectThread}
        sortable={true}
        onSort={this._handleSort}
        sortedColumn={this.state.sortedColumn}
        sortDescending={this.state.sortDescending}
        ref="threadTable"
      />
    );
  }
}
