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
import {Observable, Subject} from 'rxjs';
import shallowEqual from 'shallowequal';
import {Icon} from './Icon';
import {
  areSetsEqual,
  objectMapValues,
  objectFromPairs,
  arrayEqual,
} from 'nuclide-commons/collection';
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
  component?: React.ComponentType<{data: any}>,
  shouldRightAlign?: boolean,
  // A class to add to the cell. This will be added to both the header and body; you can
  // differentiate between them with `.nuclide-ui-table-header-cell` and
  // `.nuclide-ui-table-body-cell`.
  cellClassName?: string,
  // A minimum width (in pixels) for the column.
  minWidth?: number,
};

export type Row<T: Object> = {
  className?: string,
  data: T,
  rowAttributes?: Object,
};

type PercentageWidthMap<T> = {[key: $Keys<T>]: number};
// Same shape; the separate type is just used for documentation--Flow doesn't recognize a
// difference.
type PixelWidthMap<T> = {[key: $Keys<T>]: number};

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
  selectable?: boolean | ((row: T) => boolean),
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
   * Optional HTMLElement to render a custom table header. Takes precedence over
   * headerTitle.
   */
  headerElement?: React.Node,

  /**
   * Should keyboard navigation be enabled? This option exists for historical purposes. Ideally it
   * would always be enabled, however, some locations require the "native-key-bindings" class--
   * usually to enable copying to the clipboard--which prevents Atom commands from firing.
   * TODO: Find an alternative means of enabling copying in those locations, always enable keyboard
   * navigation, and remove this prop.
   */
  enableKeyboardNavigation?: ?boolean,
};

type ResizeOffset = {|
  deltaPx: number, // In pixels
  resizerLocation: number, // The column after which the resizer is located.
|};

type State<T> = {|
  tableWidth: number,

  // The user's preferred column distributions. These do not take into account the minimum widths.
  preferredColumnWidths: PercentageWidthMap<T>,

  // During a drag operation, specifies the change the user desires in the column size (and to which
  // column). This is kept as a separate piece of state from the calculated widths and only combined
  // with them in `render()` so that we can recalculate widths if the table changes size. We could
  // also support cancelation of the resize (though we don't yet).
  resizeOffset: ?ResizeOffset,

  // It's awkward to have hover styling when you're using keyboard navigation and the mouse just
  // happens to be over a row. Therefore, we'll keep track of when you use keyboard navigation and
  // will disable the hover state until you move the mouse again.
  usingKeyboard: boolean,

  // Reflects the previous value stored in `this.props.columns`. Used exclusively
  // by `getDerivedStateFromProps` to determine whether to change column width.
  lastColumns: ?Array<Column<T>>,
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
  _mouseMoveDisposable: ?IDisposable;
  _rootNode: ?HTMLDivElement;
  _disposables: UniversalDisposable;
  _tableBody: ?HTMLElement;

  _resizeStarts: Subject<{
    event: SyntheticMouseEvent<*>,
    resizerLocation: number,
  }>;

  static getDerivedStateFromProps(
    nextProps: Props<T>,
    prevState: State<T>,
  ): $Shape<State<T>> {
    const newState = {};
    if (nextProps.columns !== prevState.lastColumns) {
      newState.lastColumns = nextProps.columns;
    }
    // Did the columns change? If so, we need to recalculate the widths.
    const currentColumns = prevState.lastColumns;
    const nextColumns = nextProps.columns;

    if (currentColumns == null) {
      return newState;
    }

    if (
      nextColumns.length !== currentColumns.length ||
      // If the columns just changed order, we want to keep their widths.
      !areSetsEqual(
        new Set(currentColumns.map(column => column.key)),
        new Set(nextColumns.map(column => column.key)),
      )
    ) {
      newState.preferredColumnWidths = getInitialPreferredColumnWidths(
        nextColumns,
      );
    }

    return newState;
  }

  constructor(props: Props<T>) {
    super(props);
    this._resizeStarts = new Subject();
    this.state = {
      preferredColumnWidths: getInitialPreferredColumnWidths(props.columns),
      resizeOffset: null,
      tableWidth: 0,
      usingKeyboard: false,
      lastColumns: null,
    };
  }

  shouldComponentUpdate(nextProps: Props<T>, nextState: State<T>): boolean {
    // If the state changed, we need to re-render.
    if (!shallowEqual(nextState, this.state, compareState)) {
      return true;
    }

    if (!shallowEqual(nextProps, this.props, compareCheapProps)) {
      return true;
    }

    if (!arrayEqual(nextProps.columns, this.props.columns, shallowEqual)) {
      return true;
    }

    if (!arrayEqual(nextProps.rows, this.props.rows)) {
      return true;
    }

    return false;
  }

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
      this._resizeStarts
        .switchMap(({event: startEvent, resizerLocation}) => {
          const startX = startEvent.pageX;
          return Observable.fromEvent(document, 'mousemove')
            .takeUntil(Observable.fromEvent(document, 'mouseup'))
            .map(event => ({
              deltaPx: event.pageX - startX,
              resizerLocation,
            }))
            .concat(Observable.of(null));
        })
        .subscribe(resizeOffset => {
          if (resizeOffset == null) {
            // Finalize the resize by updating the user's preferred column widths to account for
            // their action. Note that these preferences are only updated when columns are resized
            // (NOT when the table is). This is important so that, if the user resizes the table
            // such that a column is at its minimum width and then resizes the table back to its
            // orignal size, their original column widths are restored.
            const preferredColumnWidths = _calculatePreferredColumnWidths({
              currentWidths: this._calculateColumnWidths(),
              // TODO: (wbinnssmith) T30771435 this setState depends on current state
              // and should use an updater function rather than an object
              // eslint-disable-next-line react/no-access-state-in-setstate
              tableWidth: this.state.tableWidth,
              minWidths: getMinWidths(this.props.columns),
            });

            // Update the preferred distributions and end the resize.
            this.setState({preferredColumnWidths, resizeOffset: null});
          } else {
            this.setState({resizeOffset});
          }
        }),
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

  _selectRow = (options: {|
    index: number,
    event: SelectionEvent,
    confirm?: boolean,
  |}): void => {
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
  };

  _handleSortByColumn = (sortedBy: $Keys<T>): void => {
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
  };

  // Just a bound version of the `_calculateColumnWidths` function for convenience.
  _calculateColumnWidths(): PercentageWidthMap<T> {
    return _calculateColumnWidths({
      preferredWidths: this.state.preferredColumnWidths,
      minWidths: getMinWidths(this.props.columns),
      tableWidth: this.state.tableWidth,
      columnOrder: this.props.columns.map(column => column.key),
      resizeOffset: this.state.resizeOffset,
    });
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
      collapsable,
      columns,
      enableKeyboardNavigation,
      emptyComponent,
      headerElement,
      headerTitle,
      maxBodyHeight,
      onBodyBlur,
      onBodyFocus,
      rows,
      selectable,
      selectedIndex,
      sortable,
      sortedColumn,
      sortDescending,
    } = this.props;

    const columnWidths = this._calculateColumnWidths();
    return (
      <>
        <TableHeader
          columns={columns}
          columnWidths={columnWidths}
          headerElement={headerElement}
          headerTitle={headerTitle}
          onSortByColumn={this._handleSortByColumn}
          resizeStarts={this._resizeStarts}
          sortable={sortable}
          sortedColumn={sortedColumn}
          sortDescending={sortDescending}
        />
        <TableBody
          emptyComponent={emptyComponent}
          enableKeyboardNavigation={enableKeyboardNavigation}
          rows={rows}
          columns={columns}
          columnWidths={columnWidths}
          selectable={selectable}
          usingKeyboard={this.state.usingKeyboard}
          selectRow={this._selectRow}
          onBodyBlur={onBodyBlur}
          onBodyFocus={onBodyFocus}
          alternateBackground={alternateBackground}
          collapsable={collapsable}
          selectedIndex={selectedIndex}
          maxBodyHeight={maxBodyHeight}
          tableRef={el => {
            this._tableBody = el;
          }}
        />
      </>
    );
  }
}

function EmptyCellContent(): React.Node {
  return <div />;
}

type TableHeaderProps<T> = {|
  columns: Array<Column<T>>,
  columnWidths: PercentageWidthMap<T>,
  headerElement: ?React.Node,
  headerTitle: ?string,
  onSortByColumn: (sortedBy: $Keys<T>) => void,
  resizeStarts: Subject<{
    event: SyntheticMouseEvent<*>,
    resizerLocation: number,
  }>,
  sortable: ?boolean,
  sortDescending: ?boolean,
  sortedColumn: ?$Keys<T>,
|};
class TableHeader<T: Object> extends React.PureComponent<TableHeaderProps<T>> {
  render(): React.Node {
    const {
      columns,
      columnWidths,
      headerElement,
      headerTitle,
      onSortByColumn,
      resizeStarts,
      sortable,
      sortDescending,
      sortedColumn,
    } = this.props;

    let inner;
    if (headerElement != null || headerTitle != null) {
      inner = (
        <div className="nuclide-ui-table-header-cell nuclide-ui-table-full-header">
          {headerElement != null ? headerElement : headerTitle}
        </div>
      );
    } else {
      inner = columns.map((column, i) => {
        const {title, key, shouldRightAlign, cellClassName} = column;
        let resizer;
        if (i < columns.length - 1) {
          resizer = (
            <div
              className="nuclide-ui-table-header-resize-handle"
              onMouseDown={event => {
                resizeStarts.next({event, resizerLocation: i});
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
            onSortByColumn(key);
          };
          titleOverlay += ' – click to sort';
          if (sortedColumn === key) {
            sortIndicator = (
              <span className="nuclide-ui-table-sort-indicator">
                <Icon icon={sortDescending ? 'triangle-down' : 'triangle-up'} />
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
      });
    }

    return (
      <div key="header" className="nuclide-ui-table">
        <div className="nuclide-ui-table-header">{inner}</div>
      </div>
    );
  }
}

type TableBodyProps<T> = {|
  alternateBackground: ?number,
  collapsable: ?boolean,
  columns: Array<Column<T>>,
  columnWidths: PercentageWidthMap<T>,
  emptyComponent: ?React.ComponentType<any>,
  enableKeyboardNavigation: ?boolean,
  maxBodyHeight: ?string,
  onBodyBlur: ?(event: SyntheticEvent<*>) => mixed,
  onBodyFocus: ?(event: SyntheticEvent<*>) => mixed,
  rows: Array<Row<T>>,
  selectable: ?(boolean | ((row: T) => boolean)),
  selectedIndex: ?number,
  selectRow: (options: {|
    index: number,
    event: SelectionEvent,
    confirm?: boolean,
  |}) => void,
  tableRef: React.Ref<'div'>,
  usingKeyboard: boolean,
|};
class TableBody<T: Object> extends React.PureComponent<TableBodyProps<T>> {
  render(): React.Node {
    const {
      alternateBackground,
      collapsable,
      columns,
      columnWidths,
      emptyComponent,
      enableKeyboardNavigation,
      maxBodyHeight,
      rows,
      selectable,
      selectedIndex,
      selectRow,
      tableRef,
      usingKeyboard,
    } = this.props;

    let body;
    if (rows.length === 0) {
      const EmptyComponent = emptyComponent ?? DefaultEmptyComponent;
      body = <EmptyComponent />;
    } else {
      body = rows.map((row, i) => {
        const {className: rowClassName, data, rowAttributes} = row;
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
            datum = <EmptyCellContent />;
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
              title={typeof datum !== 'object' ? String(datum) : null}
              {...rowAttributes}>
              {datum}
            </div>
          );
        });

        const selectableRow =
          typeof selectable === 'function' ? selectable(row.data) : selectable;
        const rowProps = selectableRow
          ? {
              onClick: event => {
                switch (event.detail) {
                  // This (`event.detail === 0`) shouldn't happen normally but does when the click is
                  // triggered by the integration test.
                  case 0:
                  case 1:
                    selectRow({index: i, event});
                    return;
                  case 2:
                    // We need to check `event.detail` (instead of using `onDoubleClick`) because
                    // (for some reason) `onDoubleClick` is only firing sporadically.
                    // TODO: Figure out why. Repros in the diagnostic table with React 16.0.0 and
                    // Atom 1.22.0-beta1 (Chrome 56.0.2924.87). This may be because we're swapping out
                    // the component on the click so a different one is receiving the second?
                    selectRow({index: i, event, confirm: true});
                    return;
                }
              },
            }
          : {};
        const isSelectedRow = selectedIndex != null && i === selectedIndex;
        return (
          <div
            className={classnames(rowClassName, {
              'nuclide-ui-table-row': true,
              'nuclide-ui-table-row-selectable': selectableRow,
              'nuclide-ui-table-row-disabled':
                typeof selectable === 'function' && !selectableRow,
              'nuclide-ui-table-row-using-keyboard-nav': usingKeyboard,
              'nuclide-ui-table-row-selected': isSelectedRow,
              'nuclide-ui-table-row-alternate':
                alternateBackground !== false && i % 2 === 1,
              'nuclide-ui-table-collapsed-row': collapsable && !isSelectedRow,
            })}
            data-row-index={i}
            key={i}
            {...rowProps}>
            {renderedRow}
          </div>
        );
      });
    }

    const bodyClassNames = classnames(
      'nuclide-ui-table',
      'nuclide-ui-table-body',
      {
        // Before this class is applied only when `!this.props.selectable`
        // because (for some reason) `onDoubleClick` isn't being fired when
        // the element's "user-select" style is "none". Now re-enabling it to
        // support copy text selection
        'nuclide-ui-table-body-selectable-text': true,
        // Using native-key-bindings prevents the up and down arrows from being captured.
        'native-key-bindings': !enableKeyboardNavigation,
      },
    );

    const scrollableBodyStyle = {};
    if (maxBodyHeight != null) {
      scrollableBodyStyle.maxHeight = maxBodyHeight;
      scrollableBodyStyle.overflowY = 'auto';
    }
    return (
      <div
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
        {/* eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs */}
        <div ref={tableRef} className={bodyClassNames} tabIndex="-1">
          {body}
        </div>
      </div>
    );
  }
}

/**
 * Get the initial size of each column as a percentage of the total.
 */
function getInitialPreferredColumnWidths<T: Object>(
  columns: Array<Column<T>>,
): PercentageWidthMap<T> {
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

function getMinWidths<T: Object>(columns: Array<Column<T>>): PixelWidthMap<T> {
  const minWidths = {};
  columns.forEach(column => {
    minWidths[column.key] =
      column.minWidth == null ? DEFAULT_MIN_COLUMN_WIDTH : column.minWidth;
  });
  return minWidths;
}

/**
 * Calculate widths, taking into account the preferred and minimum widths. Exported for testing
 * only.
 */
export function _calculateColumnWidths<T: Object>(options: {
  preferredWidths: PercentageWidthMap<T>,
  minWidths: PixelWidthMap<T>,
  tableWidth: number,
  columnOrder: Array<$Keys<T>>,
  resizeOffset: ?ResizeOffset,
}): PercentageWidthMap<T> {
  const {
    preferredWidths,
    minWidths: minWidthsPx,
    tableWidth,
    columnOrder,
    resizeOffset: resizeOffset_,
  } = options;
  const resizeOffset = resizeOffset_ || {deltaPx: 0, resizerLocation: 0};
  const widthsPx = {};

  // Calculate the pixel widths of each column given its desired percentage width and minimum pixel
  // width.
  {
    // Figure out how many pixels each column wants, given the current available width.
    let widthToAllocate = tableWidth;
    let columnsToAllocate = columnOrder;
    while (columnsToAllocate.length > 0 && widthToAllocate > 0) {
      const remainingPct = columnsToAllocate
        .map(columnName => preferredWidths[columnName])
        .reduce((a, b) => a + b, 0);
      const desiredWidthsPx = objectFromPairs(
        columnsToAllocate.map(columnName => {
          const desiredPct = preferredWidths[columnName] / remainingPct;
          const desiredPx = Math.round(desiredPct * widthToAllocate);
          return [columnName, desiredPx];
        }),
      );

      // Allocate widths for the columns who want less than their minimum width.
      let remainingPx = widthToAllocate;
      let remainingColumns = [];
      columnsToAllocate.forEach(columnName => {
        const desiredPx = desiredWidthsPx[columnName];
        const minPx = minWidthsPx[columnName];
        if (minPx >= desiredPx) {
          widthsPx[columnName] = Math.min(minPx, remainingPx);
          remainingPx -= widthsPx[columnName];
        } else {
          remainingColumns.push(columnName);
        }
      });

      // If we didn't need to truncate any of the columns, give them all their desired width.
      if (columnsToAllocate.length === remainingColumns.length) {
        Object.assign(widthsPx, desiredWidthsPx);
        remainingColumns = [];
      }

      // If we had to truncate any of the columns, that changes the calculations for how big the
      // remaining columns want to be, so make another pass.
      widthToAllocate = remainingPx;
      columnsToAllocate = remainingColumns;
    }
  }

  {
    // Adjust the column widths according to the resized column.
    const {deltaPx, resizerLocation} = resizeOffset;
    const leftColumns = columnOrder.slice(0, resizerLocation + 1);
    const rightColumns = columnOrder.slice(resizerLocation + 1);

    const [shrinkingColumns, growingColumn] =
      deltaPx < 0
        ? [leftColumns.reverse(), rightColumns[0]]
        : [rightColumns, leftColumns[leftColumns.length - 1]];
    const targetChange = Math.abs(deltaPx);
    let cumulativeChange = 0;

    for (const columnName of shrinkingColumns) {
      const startWidth = widthsPx[columnName];
      const minWidth = minWidthsPx[columnName];
      const remainingWidth = targetChange - cumulativeChange;
      const newWidth = Math.max(minWidth, startWidth - remainingWidth);
      const change = Math.abs(startWidth - newWidth);
      cumulativeChange += change;
      widthsPx[columnName] = newWidth;
      if (cumulativeChange >= targetChange) {
        break;
      }
    }

    widthsPx[growingColumn] += cumulativeChange;
  }

  // Convert all the widths from pixels to percentages.
  const widths = {};
  {
    let remainingWidth = 1;
    columnOrder.forEach((columnName, i) => {
      const isLastColumn = i === columnOrder.length - 1;
      if (isLastColumn) {
        // Give the last column all the remaining to account for rounding issues.
        widths[columnName] = remainingWidth;
      } else {
        widths[columnName] = widthsPx[columnName] / tableWidth;
        remainingWidth -= widths[columnName];
      }
    });
  }

  return widths;
}

/**
 * Given the current (percentage) widths of each column, determines what user-preferred distribution
 * this represents. Exported for testing only.
 */
export function _calculatePreferredColumnWidths<T: Object>(options: {
  currentWidths: PercentageWidthMap<T>,
  tableWidth: number,
  minWidths: PixelWidthMap<T>,
}): PercentageWidthMap<T> {
  const {currentWidths, tableWidth, minWidths: minWidthsPx} = options;
  const currentWidthsPx = objectMapValues(currentWidths, w => w * tableWidth);

  // If any column is at its minimum width, we take that to mean that the user wants the column
  // remain at its minimum if the table is resized (as opposed to maintaining the same percentage).
  // Accordingly, we make that column's preferred width 0.

  const preferredColumnWidths = {};

  // Figure out which columns are at their minimum widths.
  let remainingPx = 0; // The width that isn't accounted for after minWidth.
  const columnsNotAtMinimum = [];
  for (const [columnName, widthPx] of Object.entries(currentWidthsPx)) {
    invariant(typeof widthPx === 'number');
    const minWidthPx = minWidthsPx[columnName];
    if (Math.floor(widthPx) <= minWidthPx) {
      // Keep it at its min-width.
      preferredColumnWidths[columnName] = 0;
    } else {
      remainingPx += widthPx;
      columnsNotAtMinimum.push([columnName, widthPx]);
    }
  }

  // Now distribute the widths of the other columns.
  let remainingPct = 1;
  columnsNotAtMinimum.forEach(([columnName, width], index) => {
    const isLastColumn = index === columnsNotAtMinimum.length - 1;
    if (isLastColumn) {
      // We give the last column the remaining width just to be certain they all add up to 1.
      preferredColumnWidths[columnName] = remainingPct;
    } else {
      preferredColumnWidths[columnName] = width / remainingPx;
      remainingPct -= preferredColumnWidths[columnName];
    }
  });

  return preferredColumnWidths;
}

/**
 * An equality check for comparing Props using `shallowEqual()`. This only performs the cheap
 * checks and assumes that the rows and columns are equal. (They can be checked separatedly iff
 * necessary.)
 */
function compareCheapProps(a: mixed, b: mixed, key: ?string): boolean | void {
  switch (key) {
    case undefined:
      // This is a magic way of telling `shallowEqual()` to use the default comparison for the
      // props objects (inspect its members).
      return undefined;
    case 'rows':
    case 'columns':
      // We'll check these later iff we need to since they're more expensive.
      return true;
    default:
      return a === b;
  }
}

function compareState(a: mixed, b: mixed, key: ?string): boolean | void {
  switch (key) {
    case undefined:
      return undefined;
    case 'lastColumns':
      // `lastColumns` isn't used to render anything and only exists for
      // `getDerivedStateFromProps`. Don't count this toward rerendering.
      return true;
    default:
      return a === b;
  }
}
