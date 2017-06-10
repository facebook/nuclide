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

import classnames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';
import {Disposable} from 'atom';
import {Icon} from './Icon';

const DefaultEmptyComponent = () => (
  <div className="nuclide-ui-table-empty-message">Empty table</div>
);

// ColumnKey must be unique within the containing collection.
type ColumnKey = string;
export type Column = {
  title: string,
  key: ColumnKey,
  // Percentage. The `width`s of all columns must add up to 1.
  width?: number,
  // Optional React component for rendering cell contents.
  // The component receives the cell value via `props.data`.
  component?: ReactClass<any>,
  shouldRightAlign?: boolean,
};
export type Row = {
  +className?: string,
  +data: {
    +[key: ColumnKey]: ?mixed,
  },
};
type WidthMap = {
  [key: ColumnKey]: number,
};
type Props = {
  /**
   * Optional classname for the entire table.
   */
  className?: string,
  /**
   * Optional max-height for the body container.
   * Useful for making the table scrollable while keeping the header fixed.
   */
  maxBodyHeight?: string,
  columns: Array<Column>,
  rows: Array<Row>,
  /**
   * Whether to shade even and odd items differently. Default behavior is `true`.
   */
  alternateBackground?: number,
  /**
   * Whether column widths can be resized interactively via drag&drop. Default behavior is `true`.
   */
  resizeable?: boolean,
  children?: React.Element<any>,
  /**
   * Whether columns can be sorted.
   * If specified, `onSort`, `sortedColumn`, and `sortDescending` must also be specified.
   */
  sortable?: boolean,
  onSort?: (sortedBy: ?ColumnKey, sortDescending: boolean) => void,
  sortedColumn?: ?ColumnKey,
  sortDescending?: boolean,
  /**
   * Whether items can be selected.
   * If specified, `onSelect` must also be specified.
   */
  selectable?: boolean,
  selectedIndex?: ?number,
  /**
   * Handler to be called upon selection. Called iff `selectable` is `true`.
   */
  onSelect?: (selectedItem: any, selectedIndex: number) => mixed,
  /**
   * Optional React Component to override the default message when zero rows are provided.
   * Useful for showing loading spinners and custom messages.
   */
  emptyComponent?: ReactClass<any>,
  /**
   * Whether a table row will be collapsed if its content is too large
   */
  collapsable?: boolean,
  /**
   * Whether there's a header title spanning all cells instead of the column titles.
   * It disables the 'sortable' prop.
   */
  headerTitle?: string,
};
type State = {
  columnWidthRatios: WidthMap,
};

export class Table extends React.Component {
  props: Props;
  state: State;
  _globalEventsDisposable: ?Disposable;
  _resizeStartX: ?number;
  _tableWidth: ?number;
  _columnBeingResized: ?ColumnKey;

  constructor(props: Props) {
    super(props);
    this._globalEventsDisposable = null;
    this._resizeStartX = null;
    this._tableWidth = null;
    this._columnBeingResized = null;
    (this: any)._handleResizerGlobalMouseUp = this._handleResizerGlobalMouseUp.bind(
      this,
    );
    (this: any)._handleResizerGlobalMouseMove = this._handleResizerGlobalMouseMove.bind(
      this,
    );
    this.state = {
      columnWidthRatios: this._getInitialWidthsForColumns(this.props.columns),
    };
  }

  _getInitialWidthsForColumns(columns: Array<Column>): WidthMap {
    const columnWidthRatios = {};
    let assignedWidth = 0;
    const unresolvedColumns = [];
    columns.forEach(column => {
      const {key, width} = column;
      if (width != null) {
        columnWidthRatios[key] = width;
        assignedWidth += width;
      } else {
        unresolvedColumns.push(column);
      }
    });
    const residualColumnWidth = (1 - assignedWidth) / unresolvedColumns.length;
    unresolvedColumns.forEach(column => {
      columnWidthRatios[column.key] = residualColumnWidth;
    });
    return columnWidthRatios;
  }

  /* Applies sizing constraints, and returns whether the column width actually changed. */
  _updateWidths(resizedColumn: ColumnKey, newColumnSize: number): boolean {
    const {columnWidthRatios} = this.state;
    const {columns} = this.props;
    const originalColumnSize = columnWidthRatios[resizedColumn];
    const columnAfterResizedColumn =
      columns[columns.findIndex(column => column.key === resizedColumn) + 1]
        .key;
    const followingColumnSize = columnWidthRatios[columnAfterResizedColumn];
    const constrainedNewColumnSize = Math.max(
      0,
      Math.min(newColumnSize, followingColumnSize + originalColumnSize),
    );
    if (Math.abs(newColumnSize - constrainedNewColumnSize) > Number.EPSILON) {
      return false;
    }
    const updatedColumnWidths = {};
    columns.forEach(column => {
      const {key} = column;
      let width;
      if (column.key === resizedColumn) {
        width = constrainedNewColumnSize;
      } else if (column.key === columnAfterResizedColumn) {
        width =
          columnWidthRatios[resizedColumn] -
          constrainedNewColumnSize +
          columnWidthRatios[key];
      } else {
        width = columnWidthRatios[key];
      }
      updatedColumnWidths[key] = width;
    });
    this.setState({
      columnWidthRatios: updatedColumnWidths,
    });
    return true;
  }

  _handleResizerMouseDown(key: ColumnKey, event: SyntheticMouseEvent): void {
    if (this._globalEventsDisposable != null) {
      this._unsubscribeFromGlobalEvents();
    }
    // Prevent browser from initiating drag events on accidentally selected elements.
    const selection = document.getSelection();
    if (selection != null) {
      selection.removeAllRanges();
    }
    document.addEventListener('mousemove', this._handleResizerGlobalMouseMove);
    document.addEventListener('mouseup', this._handleResizerGlobalMouseUp);
    this._resizeStartX = event.pageX;
    // $FlowFixMe
    this._tableWidth = ReactDOM.findDOMNode(
      this.refs.table,
    ).getBoundingClientRect().width;
    this._columnBeingResized = key;
    this._globalEventsDisposable = new Disposable(() => {
      document.removeEventListener(
        'mousemove',
        this._handleResizerGlobalMouseMove,
      );
      document.removeEventListener('mouseup', this._handleResizerGlobalMouseUp);
      this._resizeStartX = null;
      this._tableWidth = null;
      this._columnBeingResized = null;
    });
  }

  _unsubscribeFromGlobalEvents(): void {
    if (this._globalEventsDisposable == null) {
      return;
    }
    this._globalEventsDisposable.dispose();
    this._globalEventsDisposable = null;
  }

  _handleResizerGlobalMouseUp(event: MouseEvent): void {
    this._unsubscribeFromGlobalEvents();
  }

  _handleResizerGlobalMouseMove(event: MouseEvent): void {
    if (
      this._resizeStartX == null ||
      this._tableWidth == null ||
      this._columnBeingResized == null
    ) {
      return;
    }
    const {pageX} = ((event: any): MouseEvent);
    const deltaX = pageX - this._resizeStartX;
    const currentColumnSize = this.state.columnWidthRatios[
      this._columnBeingResized
    ];
    const didUpdate = this._updateWidths(
      this._columnBeingResized,
      (this._tableWidth * currentColumnSize + deltaX) / this._tableWidth,
    );
    if (didUpdate) {
      this._resizeStartX = pageX;
    }
  }

  _dispose(): void {
    this._unsubscribeFromGlobalEvents();
  }

  componentWillUnmount(): void {
    this._dispose();
  }

  _handleSortByColumn(sortedBy: ColumnKey): void {
    const {onSort, sortDescending, sortedColumn} = this.props;
    if (onSort == null) {
      return;
    }
    onSort(
      sortedBy,
      sortDescending == null || sortedBy !== sortedColumn
        ? false
        : !sortDescending,
    );
  }

  _handleRowClick(selectedIndex: number, event: SyntheticMouseEvent): void {
    const {onSelect, rows} = this.props;
    if (onSelect == null) {
      return;
    }
    const selectedItem = rows[selectedIndex];
    onSelect(selectedItem.data, selectedIndex);
  }

  _renderEmptyCellContent(): React.Element<any> {
    return <div />;
  }

  render(): React.Element<any> {
    const {
      alternateBackground,
      className,
      columns,
      headerTitle,
      maxBodyHeight,
      rows,
      selectable,
      selectedIndex,
      sortable,
      sortedColumn,
      sortDescending,
    } = this.props;
    const header = headerTitle != null
      ? <div className="nuclide-ui-table-header-cell nuclide-ui-table-full-header">
          {headerTitle}
        </div>
      : columns.map((column, i) => {
          const {title, key, shouldRightAlign} = column;
          const resizeHandle = i === columns.length - 1
            ? null
            : <div
                className="nuclide-ui-table-header-resize-handle"
                onMouseDown={this._handleResizerMouseDown.bind(this, key)}
                onClick={(e: SyntheticMouseEvent) => {
                  // Prevent sortable column header click event from firing.
                  e.stopPropagation();
                }}
              />;
          const width = this.state.columnWidthRatios[key];
          const optionalHeaderCellProps = {};
          if (width != null) {
            optionalHeaderCellProps.style = {
              width: width * 100 + '%',
            };
          }
          let sortIndicator;
          let titleOverlay = title;
          if (sortable) {
            optionalHeaderCellProps.onClick = this._handleSortByColumn.bind(
              this,
              key,
            );
            titleOverlay += ' – click to sort';
            if (sortedColumn === key) {
              sortIndicator = (
                <span className="nuclide-ui-table-sort-indicator">
                  <Icon
                    icon={sortDescending ? 'triangle-down' : 'triangle-up'}
                  />
                </span>
              );
            }
          }
          return (
            <div
              className={classnames({
                'nuclide-ui-table-cell-text-align-right': shouldRightAlign,
                'nuclide-ui-table-header-cell': true,
                'nuclide-ui-table-header-cell-sortable': sortable,
              })}
              title={titleOverlay}
              key={key}
              {...optionalHeaderCellProps}>
              {title}
              {sortIndicator}
              {resizeHandle}
            </div>
          );
        });
    let body = rows.map((row, i) => {
      const {className: rowClassName, data} = row;
      const renderedRow = columns.map((column, j) => {
        const {key, component: Component, shouldRightAlign} = column;
        let datum = data[key];
        if (Component != null) {
          datum = <Component data={datum} />;
        } else if (datum == null) {
          datum = this._renderEmptyCellContent();
        }
        const cellStyle = {};
        const width = this.state.columnWidthRatios[key];
        if (width != null) {
          cellStyle.width = width * 100 + '%';
        }
        return (
          <div
            className={classnames({
              'nuclide-ui-table-body-cell': true,
              'nuclide-ui-table-cell-text-align-right': shouldRightAlign,
            })}
            key={j}
            style={cellStyle}
            title={typeof datum !== 'object' ? String(datum) : null}>
            {datum}
          </div>
        );
      });
      const rowProps = {};
      if (selectable) {
        rowProps.onClick = this._handleRowClick.bind(this, i);
      }
      const isSelectedRow = selectedIndex != null && i === selectedIndex;
      return (
        <div
          className={classnames(rowClassName, {
            'nuclide-ui-table-row': true,
            'nuclide-ui-table-row-selectable': selectable,
            'nuclide-ui-table-row-selected': isSelectedRow,
            'nuclide-ui-table-row-alternate': alternateBackground !== false &&
              i % 2 === 1,
            'nuclide-ui-table-collapsed-row': this.props.collapsable &&
              !isSelectedRow,
          })}
          key={i}
          {...rowProps}>
          {renderedRow}
        </div>
      );
    });
    if (rows.length === 0) {
      const EmptyComponent = this.props.emptyComponent || DefaultEmptyComponent;
      body = <EmptyComponent />;
    }
    const scrollableBodyStyle = {};
    if (maxBodyHeight != null) {
      scrollableBodyStyle.maxHeight = maxBodyHeight;
      scrollableBodyStyle.overflowY = 'auto';
    }
    return (
      <div className={className}>
        <div className="nuclide-ui-table" ref="table">
          <div className="nuclide-ui-table-header">{header}</div>
        </div>
        <div style={scrollableBodyStyle}>
          <div
            className="nuclide-ui-table nuclide-ui-table-body native-key-bindings"
            tabIndex="-1">
            {body}
          </div>
        </div>
      </div>
    );
  }
}
