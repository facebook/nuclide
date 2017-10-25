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

import invariant from 'assert';
import nullthrows from 'nullthrows';
import classnames from 'classnames';
import * as React from 'react';
import {Observable} from 'rxjs';
import {Icon} from './Icon';
import {areSetsEqual} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ResizeObservable} from './observable-dom';
import {scrollIntoViewIfNeeded} from './scrollIntoView';

type SelectionEvent = SyntheticEvent<*> | Event;

const DEFAULT_MIN_COLUMN_WIDTH = 40;

const DefaultEmptyComponent = () => (
  <div className="nuclide-ui-table-empty-message">Empty table</div>
);

export type Column<T: Object> = {
  title: string,
  key: $Keys<T>,
  // Percentage. The `width`s of all columns must add up to 1.
  width?: number,
  // Optional React component for rendering cell contents.
  // The component receives the cell value via `props.data`.
  component?: React.ComponentType<any>,
  shouldRightAlign?: boolean,
  // A class to add to the cell. This will be added to both the header and body; you can
  // differentiate between them with `.nuclide-ui-table-header-cell` and
  // `.nuclide-ui-table-body-cell`.
  cellClassName?: string,
  // A minimum width (in pixels) for the column.
  minWidth?: number,
};
export type Row<T: Object> = {
  +className?: string,
  +data: T,
};
type WidthMap<T> = {
  [key: $Keys<T>]: number,
};
type Props<T> = {
  /**
   * Optional classname for the entire table.
   */
  className?: string,
  /**
   * Optional max-height for the body container.
   * Useful for making the table scrollable while keeping the header fixed.
   */
  maxBodyHeight?: string,
  columns: Array<Column<T>>,
  rows: Array<Row<T>>,
  /**
   * Whether to shade even and odd items differently. Default behavior is `true`.
   */
  alternateBackground?: number,
  /**
   * Whether column widths can be resized interactively via drag&drop. Default behavior is `true`.
   */
  resizable?: boolean,
  children?: React.Element<any>,
  /**
   * Whether columns can be sorted.
   * If specified, `onSort`, `sortedColumn`, and `sortDescending` must also be specified.
   */
  sortable?: boolean,
  onSort?: (sortedBy: $Keys<T>, sortDescending: boolean) => void,
  sortedColumn?: ?$Keys<T>,
  sortDescending?: boolean,
  /**
   * Whether items can be selected.
   * If specified, `onSelect` must also be specified.
   */
  selectable?: boolean,
  selectedIndex?: ?number,
  /**
   * Handler to be called upon selection. Called iff `selectable` is `true`. We pass along the event
   * because some consumers may want to take different action depending on it. For example, if you
   * click on a row in the diagnostics table, we know you want to go to that diagnostic; if you
   * select it with the keyboard, you may just be doing so incidentally while moving the selection
   * to another row.
   */
  onSelect?: (
    selectedItem: any,
    selectedIndex: number,
    event: SelectionEvent,
  ) => mixed,
  /**
   * Callback to be invoked before calling onSelect. Called iff `selectable` is `true`.
   * If this callback returns false, row selection is canceled.
   */
  onWillSelect?: (
    selectedItem: any,
    selectedIndex: number,
    event: SelectionEvent,
  ) => boolean,

  /**
   * Called when a row selection is confirmed. Currently, this is done either by triggering
   * "core:confirm" while an item is selected or by single clicking (which selects and confirms).
   * In the future, we may consider moving single click to select-only and requiring double click
   * for confirmation.
   */
  onConfirm?: (selectedItem: any, selectedIndex: number) => mixed,

  onBodyBlur?: (event: SyntheticEvent<*>) => mixed,
  onBodyFocus?: (event: SyntheticEvent<*>) => mixed,

  /**
   * Optional React Component to override the default message when zero rows are provided.
   * Useful for showing loading spinners and custom messages.
   */
  emptyComponent?: React.ComponentType<any>,
  /**
   * Whether a table row will be collapsed if its content is too large
   */
  collapsable?: boolean,
  /**
   * Whether there's a header title spanning all cells instead of the column titles.
   * It disables the 'sortable' prop.
   */
  headerTitle?: string,

  /**
   * Should keyboard navigation be enabled? This option exists for historical purposes. Ideally it
   * would always be enabled, however, some locations require the "native-key-bindings" class--
   * usually to enable copying to the clipboard--which prevents Atom commands from firing.
   * TODO: Find an alternative means of enabling copying in those locations, always enable keyboard
   * navigation, and remove this prop.
   */
  enableKeyboardNavigation?: ?boolean,
};

type State<T> = {|
  tableWidth: number,
  preferredColumnWidths: WidthMap<T>,

  // It's awkward to have hover styling when you're using keyboard navigation and the mouse just
  // happens to be over a row. Therefore, we'll keep track of when you use keyboard navigation and
  // will disable the hover state until you move the mouse again.
  usingKeyboard: boolean,
|};

/**
 * Design concerns:
 *
 * 1. Because of how it's used throughout the codebase, this Table needs to do all of the folowing:
 *        * Fill the available width of its parent
 *        * Automatically be tall enough to accommodate its contents
 *        * Have a vertically scrollable body if its parent is too small to accommodate the contents
 * 2. We need to support min widths for columns. Resizing the window or one of the component's
 *    containers should not cause a column to dip below its min width.
 *
 * This ends up being a surprisingly constraining set of concerns!
 *
 *     * We must guarantee that the contents of the table do not define the container's size.
 *       Otherwise, this we would be unable to determine the "available area" without hiding the
 *       contents, measuring, and then showing the contents again. Likewise, we could get stuck in
 *       a loop where we set the contents' size, which triggers the resize observer, which causes
 *       us to remeasure the container size and adjust the contents, which triggers the resize
 *       observer...
 *     * We can't use CSS for min width. Resizing one column affects the width of another; if we
 *       make column A smaller, column B needs to get wider to fill the extra space. But using CSS
 *       for min-width means we wouldn't know the true size, and therefore how to adjust B
 *       appropriately.
 *
 * To address these, we define our columns using percentage widths. Unfortunately, this means that
 * our table may behave a little strangely when the available area is less than the sum of the
 * minimum widths of the columns. (Ideally, the table would scroll horizontally in this case.)
 */
export class Table<T: Object> extends React.Component<Props<T>, State<T>> {
  _resizingDisposable: ?IDisposable; // Active while resizing.
  _mouseMoveDisposable: ?IDisposable;
  _rootNode: ?HTMLDivElement;
  _disposables: UniversalDisposable;
  _tableBody: ?HTMLElement;

  constructor(props: Props<T>) {
    super(props);
    this._resizingDisposable = null;
    this.state = {
      preferredColumnWidths: getInitialPercentageWidths(props.columns),
      tableWidth: 0,
      usingKeyboard: false,
    };
  }

  _handleResizerMouseDown(
    event: SyntheticMouseEvent<>,
    resizerLocation: number,
  ): void {
    if (this._resizingDisposable != null) {
      this._stopResizing();
    }
    // Prevent browser from initiating drag events on accidentally selected elements.
    const selection = document.getSelection();
    if (selection != null) {
      selection.removeAllRanges();
    }
    const tableWidth = this.refs.table.getBoundingClientRect().width;
    const startX = event.pageX;
    const startWidths = this._getColumnWidths();
    this._resizingDisposable = new UniversalDisposable(
      Observable.fromEvent(document, 'mousemove').subscribe(evt => {
        this._handleResizerGlobalMouseMove(
          evt,
          startX,
          // $FlowFixMe(>=0.55.0) Flow suppress
          startWidths,
          resizerLocation,
          tableWidth,
        );
      }),
      Observable.fromEvent(document, 'mouseup').subscribe(() => {
        this._stopResizing();
      }),
    );
  }

  _stopResizing(): void {
    if (this._resizingDisposable == null) {
      return;
    }
    this._resizingDisposable.dispose();
    this._resizingDisposable = null;
  }

  _handleResizerGlobalMouseMove = (
    event: MouseEvent,
    startX: number,
    startWidths: WidthMap<T>,
    resizerLocation: number, // The index of the column after which the resizer appears.
    tableWidth: number,
  ): void => {
    const pxToRatio = px => px / tableWidth;
    const leftColumns = this.props.columns.slice(0, resizerLocation + 1);
    const rightColumns = this.props.columns.slice(resizerLocation + 1);

    const delta = pxToRatio(event.pageX - startX);
    const [shrinkingColumns, growingColumn] =
      delta < 0
        ? [leftColumns.reverse(), rightColumns[0]]
        : [rightColumns, leftColumns[leftColumns.length - 1]];
    const targetChange = Math.abs(delta);
    let cumulativeChange = 0;
    const newWidths = {...this.state.preferredColumnWidths};

    for (const column of shrinkingColumns) {
      const {key} = column;
      const startWidth = startWidths[key];
      const minWidth = pxToRatio(
        column.minWidth == null ? DEFAULT_MIN_COLUMN_WIDTH : column.minWidth,
      );
      const remainingDistance = targetChange - cumulativeChange;
      const newWidth = Math.max(minWidth, startWidth - remainingDistance);
      const change = Math.abs(startWidth - newWidth);
      cumulativeChange += change;
      newWidths[key] = newWidth;
      if (cumulativeChange >= targetChange) {
        break;
      }
    }

    // Determine the width of the growing column. Instead of adding `cumulativeChange` to its
    // starting width, we figure out what percentage of the table's width is still unaccounted for.
    // This ensures we avoid snowballing floating point errors.
    newWidths[growingColumn.key] = Object.entries(
      newWidths,
    ).reduce((remaining, [key, width]) => {
      invariant(typeof width === 'number');
      return key === growingColumn.key ? remaining : remaining - width;
    }, 1);

    this.setState({preferredColumnWidths: newWidths});
  };

  componentDidMount(): void {
    const el = nullthrows(this._rootNode);

    this._disposables = new UniversalDisposable(
      // Update the column widths when the table is resized.
      new ResizeObservable(el)
        .startWith((null: any))
        .map(() => el.offsetWidth)
        .filter(tableWidth => tableWidth > 0)
        .subscribe(tableWidth => {
          this.setState({tableWidth});
        }),
      () => {
        this._stopResizing();
      },
      atom.commands.add(el, {
        'core:move-up': event => {
          this.setState({usingKeyboard: true});
          this._moveSelection(-1, event);
        },
        'core:move-down': event => {
          this.setState({usingKeyboard: true});
          this._moveSelection(1, event);
        },
        'core:confirm': event => {
          this.setState({usingKeyboard: true});
          const {rows, selectedIndex, onConfirm} = this.props;
          if (onConfirm == null || selectedIndex == null) {
            return;
          }
          const selectedRow = rows[selectedIndex];
          const selectedItem = selectedRow && selectedRow.data;
          if (selectedItem != null) {
            onConfirm(selectedItem, selectedIndex);
          }
        },
      }),
      () => {
        if (this._mouseMoveDisposable != null) {
          this._mouseMoveDisposable.dispose();
        }
      },
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate(prevProps: Props<T>, prevState: State<T>): void {
    if (
      this._tableBody != null &&
      this.props.selectedIndex != null &&
      this.props.selectedIndex !== prevProps.selectedIndex
    ) {
      const selectedRow = this._tableBody.children[this.props.selectedIndex];
      if (selectedRow != null) {
        scrollIntoViewIfNeeded(selectedRow);
      }
    }
    if (this.state.usingKeyboard !== prevState.usingKeyboard) {
      if (this._mouseMoveDisposable != null) {
        this._mouseMoveDisposable.dispose();
      }
      if (this.state.usingKeyboard) {
        this._mouseMoveDisposable = new UniversalDisposable(
          Observable.fromEvent(document, 'mousemove')
            .take(1)
            .subscribe(() => {
              this.setState({usingKeyboard: false});
            }),
        );
      }
    }
  }

  focus(): void {
    if (this._tableBody == null) {
      return;
    }
    let el = document.activeElement;
    while (el != null) {
      if (el === this._tableBody) {
        // Already focused!
        return;
      }
      el = el.parentNode;
    }
    this._tableBody.focus();
  }

  componentWillReceiveProps(nextProps: Props<T>): void {
    // Did the columns change? If so, we need to recalculate the widths.
    const currentColumns = this.props.columns;
    const nextColumns = nextProps.columns;
    if (
      nextColumns.length !== currentColumns.length ||
      // If the columns just changed order, we want to keep their widths.
      !areSetsEqual(
        new Set(currentColumns.map(column => column.key)),
        new Set(nextColumns.map(column => column.key)),
      )
    ) {
      this.setState({
        preferredColumnWidths: getInitialPercentageWidths(nextColumns),
      });
    }
  }

  _moveSelection(offset: -1 | 1, event: SelectionEvent): void {
    const {selectedIndex} = this.props;
    if (selectedIndex == null) {
      return;
    }
    const nextSelectedIndex = Math.max(
      0,
      Math.min(this.props.rows.length - 1, selectedIndex + offset),
    );
    if (nextSelectedIndex === selectedIndex) {
      return;
    }
    this._selectRow({index: nextSelectedIndex, event});
  }

  _selectRow(options: {|
    index: number,
    event: SelectionEvent,
    confirm?: boolean,
  |}): void {
    const {index: selectedIndex, event, confirm} = options;
    const {onSelect, onWillSelect, rows} = this.props;
    if (onSelect == null) {
      return;
    }
    const selectedRow = rows[selectedIndex];
    const selectedItem = selectedRow.data;
    if (onWillSelect != null) {
      if (onWillSelect(selectedItem, selectedIndex, event) === false) {
        return;
      }
    }
    onSelect(selectedItem, selectedIndex, event);
    if (confirm && this.props.onConfirm != null) {
      this.props.onConfirm(selectedItem, selectedIndex);
    }
  }

  _handleSortByColumn(sortedBy: $Keys<T>): void {
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

  _getColumnWidths(): WidthMap<T> {
    return ensureMinWidths(
      this.state.preferredColumnWidths,
      getMinWidths(this.props.columns),
      this.state.tableWidth,
      this.props.columns.map(column => column.key),
    );
  }

  _renderEmptyCellContent(): React.Element<any> {
    return <div />;
  }

  render(): React.Node {
    return (
      <div
        className={this.props.className}
        ref={rootNode => (this._rootNode = rootNode)}>
        {this._renderContents()}
      </div>
    );
  }

  _renderContents(): React.Node {
    if (this.state.tableWidth === 0) {
      // We don't have the table width yet so we can't render the columns.
      return null;
    }

    const {
      alternateBackground,
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

    const columnWidths = this._getColumnWidths();

    const header =
      headerTitle != null ? (
        <div className="nuclide-ui-table-header-cell nuclide-ui-table-full-header">
          {headerTitle}
        </div>
      ) : (
        columns.map((column, i) => {
          const {title, key, shouldRightAlign, cellClassName} = column;
          let resizer;
          if (i < columns.length - 1) {
            resizer = (
              <div
                className="nuclide-ui-table-header-resize-handle"
                onMouseDown={event => {
                  this._handleResizerMouseDown(event, i);
                }}
                onClick={(e: SyntheticMouseEvent<>) => {
                  // Prevent sortable column header click event from firing.
                  e.stopPropagation();
                }}
              />
            );
          }
          const width = columnWidths[key];
          const optionalHeaderCellProps = {};
          if (width != null) {
            optionalHeaderCellProps.style = {width: `${width * 100}%`};
          }
          let sortIndicator;
          let titleOverlay = title;
          if (sortable) {
            optionalHeaderCellProps.onClick = () => {
              this._handleSortByColumn(key);
            };
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
              className={classnames(cellClassName, {
                'nuclide-ui-table-cell-text-align-right': shouldRightAlign,
                'nuclide-ui-table-header-cell': true,
                'nuclide-ui-table-header-cell-sortable': sortable,
              })}
              title={titleOverlay}
              key={key}
              {...optionalHeaderCellProps}>
              {title}
              {sortIndicator}
              {resizer}
            </div>
          );
        })
      );
    let body = rows.map((row, i) => {
      const {className: rowClassName, data} = row;
      const renderedRow = columns.map((column, j) => {
        const {
          key,
          cellClassName,
          component: Component,
          shouldRightAlign,
        } = column;
        let datum = data[key];
        if (Component != null) {
          datum = <Component data={datum} />;
        } else if (datum == null) {
          datum = this._renderEmptyCellContent();
        }
        const cellStyle = {};
        const width = columnWidths[key];
        if (width != null) {
          cellStyle.width = `${width * 100}%`;
        }
        return (
          <div
            className={classnames(cellClassName, {
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
      const rowProps = selectable
        ? {
            onClick: event => {
              this._selectRow({index: i, event});
            },
            onDoubleClick: event => {
              this._selectRow({index: i, event, confirm: true});
            },
          }
        : {};
      const isSelectedRow = selectedIndex != null && i === selectedIndex;
      return (
        <div
          className={classnames(rowClassName, {
            'nuclide-ui-table-row': true,
            'nuclide-ui-table-row-selectable': selectable,
            'nuclide-ui-table-row-using-keyboard-nav': this.state.usingKeyboard,
            'nuclide-ui-table-row-selected': isSelectedRow,
            'nuclide-ui-table-row-alternate':
              alternateBackground !== false && i % 2 === 1,
            'nuclide-ui-table-collapsed-row':
              this.props.collapsable && !isSelectedRow,
          })}
          data-row-index={i}
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
    const bodyClassNames = classnames(
      'nuclide-ui-table',
      'nuclide-ui-table-body',
      // Using native-key-bindings prevents the up and down arrows from being captured.
      {'native-key-bindings': !this.props.enableKeyboardNavigation},
    );
    return [
      <div key="header" className="nuclide-ui-table" ref="table">
        <div className="nuclide-ui-table-header">{header}</div>
      </div>,
      <div
        key="body"
        style={scrollableBodyStyle}
        onFocus={event => {
          if (this.props.onBodyFocus != null) {
            this.props.onBodyFocus(event);
          }
        }}
        onBlur={event => {
          if (this.props.onBodyBlur != null) {
            this.props.onBodyBlur(event);
          }
        }}>
        <div
          ref={el => {
            this._tableBody = el;
          }}
          className={bodyClassNames}
          tabIndex="-1">
          {body}
        </div>
      </div>,
    ];
  }
}

/**
 * Get the initial size of each column as a percentage of the total.
 */
function getInitialPercentageWidths<T: Object>(
  columns: Array<Column<T>>,
): WidthMap<T> {
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

function getMinWidths<T: Object>(columns: Array<Column<T>>): WidthMap<T> {
  const minWidths = {};
  columns.forEach(column => {
    minWidths[column.key] = column.minWidth;
  });
  return minWidths;
}

/**
 * Calculate widths, taking into account the preferred and minimum widths.
 */
function ensureMinWidths<T: Object>(
  preferredWidths: WidthMap<T>,
  minWidths: WidthMap<T>,
  tableWidth: number,
  columnOrder: Array<$Keys<T>>,
): WidthMap<T> {
  const adjusted = {};
  let remainingWidth = 1;
  columnOrder.forEach(columnName => {
    const minWidth = minWidths[columnName] || DEFAULT_MIN_COLUMN_WIDTH;
    const minWidthRatio = minWidth / tableWidth;
    const preferredWidth = preferredWidths[columnName];
    const width = Math.min(
      remainingWidth,
      Math.max(minWidthRatio, preferredWidth),
    );
    adjusted[columnName] = width;
    remainingWidth -= width;
  });
  return adjusted;
}
