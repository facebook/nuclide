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

import type {
  DiagnosticMessage,
  DiagnosticMessageKind,
  DiagnosticMessageType,
} from '../../../atom-ide-diagnostics/lib/types';
import type {Location, DisplayDiagnostic} from '../types';
import type {Column, Row} from 'nuclide-commons-ui/Table';
import type {IconName} from 'nuclide-commons-ui/Icon';

import classnames from 'classnames';
import invariant from 'assert';
import idx from 'idx';
import memoizeUntilChanged from 'nuclide-commons/memoizeUntilChanged';
import humanizePath from 'nuclide-commons-atom/humanizePath';
import {insideOut, arrayEqual} from 'nuclide-commons/collection';
import * as React from 'react';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {Table} from 'nuclide-commons-ui/Table';
import sortDiagnostics from '../sortDiagnostics';
import {DiagnosticsMessageNoHeader} from './DiagnosticsMessage';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';
import {Icon} from 'nuclide-commons-ui/Icon';

const DIAGNOSTICS_TO_ROWS_TRACES_MAP = new WeakMap();
const DIAGNOSTICS_TO_ROWS_NO_TRACES_MAP = new WeakMap();

// text is always used for sorting, while we render the element.
type DescriptionField = {|
  diagnostic: DiagnosticMessage,
  showTraces: boolean,
  text: string,
  isPlainText: boolean,
  description: string,
|};

type ColumnName = $Keys<DisplayDiagnostic>;

// Maximum number of results to render in the table before truncating and displaying a "Max results
// reached" message.
const MAX_RESULTS_COUNT = 1000;

type Props = {|
  diagnostics: Array<DiagnosticMessage>,
  selectedMessage: ?DiagnosticMessage,
  gotoMessageLocation: (
    message: DiagnosticMessage,
    options: {|focusEditor: boolean, pendingPane: boolean|},
  ) => void,
  selectMessage: (message: DiagnosticMessage) => void,
  showFileName: ?boolean,
  showDirectoryColumn: boolean,
  showTraces: boolean,
|};

type State = {|
  sortDescending: boolean,
  sortedColumn: ColumnName,
|};

export default class DiagnosticsTable extends React.PureComponent<
  Props,
  State,
> {
  _previousSelectedIndex: number = -1;
  _table: ?Table<DisplayDiagnostic>;

  constructor(props: Props) {
    super(props);

    // Memoize `_getRows()`
    (this: any)._getRows = memoizeUntilChanged(
      this._getRows,
      (diagnostics, showTraces) => ({
        diagnostics,
        showTraces,
      }),
      (a, b) =>
        a.showTraces === b.showTraces &&
        arrayEqual(a.diagnostics, b.diagnostics),
    );

    this.state = {
      sortDescending: true,
      sortedColumn: 'classification',
    };
  }

  _handleSort = (sortedColumn: ColumnName, sortDescending: boolean): void => {
    this.setState({
      sortedColumn,
      sortDescending,
    });
  };

  _handleSelectTableRow = (
    item: {diagnostic: DiagnosticMessage},
    index: number,
    event: Event | SyntheticEvent<*>,
  ): void => {
    this.props.selectMessage(item.diagnostic);
    // Users navigating with the keyboard may just be moving through items on their way to another.
    // If they have pending pane items enabled, it's not a big deal if we open the editor anyway.
    // But if they don't, we could wind up opening a ton of files they didn't even care about so,
    // to be safe, we won't do anything in that case.
    if (
      event.type !== 'click' &&
      !atom.config.get('core.allowPendingPaneItems')
    ) {
      return;
    }
    this.props.gotoMessageLocation(item.diagnostic, {
      focusEditor: false,
      pendingPane: event.type !== 'click',
    });
  };

  _handleConfirmTableRow = (item: {diagnostic: DiagnosticMessage}): void => {
    this.props.gotoMessageLocation(item.diagnostic, {
      focusEditor: true,
      pendingPane: false,
    });
  };

  _getColumns(): Array<Column<DisplayDiagnostic>> {
    const {showFileName, showDirectoryColumn} = this.props;

    // These need to add up to 1.
    // TODO: Update the Table component so that we can have more control over this (and provide
    //       explicit pixel widths)
    const TYPE_WIDTH = 0;
    const SOURCE_WIDTH = 0;
    const FILENAME_WIDTH = 0.3;
    const DIR_WIDTH = 0.15;
    const LINE_NUMBER_WIDTH = 0;

    const filePathColumns = [];
    let descriptionWidth = 1 - (TYPE_WIDTH + SOURCE_WIDTH);

    if (showFileName) {
      if (showDirectoryColumn) {
        filePathColumns.push({
          component: DirComponent,
          key: 'dir',
          title: 'Path',
          width: DIR_WIDTH,
          shouldRightAlign: true,
          cellClassName: 'nuclide-diagnostics-ui-cell-dir',
        });
        descriptionWidth -= DIR_WIDTH;
      }

      filePathColumns.push({
        component: FilenameComponent,
        key: 'location',
        title: 'File Name',
        width: FILENAME_WIDTH,
        cellClassName: 'nuclide-diagnostics-ui-cell-filename',
      });
      descriptionWidth -= FILENAME_WIDTH;
    } else {
      // Not showing the filename? Then we need a separate column for the line number.
      filePathColumns.push({
        component: LineNumberComponent,
        key: 'line',
        title: 'Line',
        shouldRightAlign: true,
        width: LINE_NUMBER_WIDTH,
        minWidth: 60,
      });
      descriptionWidth -= LINE_NUMBER_WIDTH;
    }

    return [
      {
        component: TypeComponent,
        key: 'classification',
        title: 'Type',
        width: TYPE_WIDTH,
        minWidth: 55,
        cellClassName: 'nuclide-diagnostics-ui-cell-classification',
      },
      {
        key: 'providerName',
        title: 'Source',
        width: SOURCE_WIDTH,
        minWidth: 100,
      },
      {
        component: this._renderDescription,
        key: 'description',
        title: 'Description',
        width: descriptionWidth,
        cellClassName: 'nuclide-diagnostics-ui-cell-description',
      },
      ...filePathColumns,
    ];
  }

  // False positive for this lint rule?
  // eslint-disable-next-line react/no-unused-prop-types
  _renderDescription = (props: {data: DescriptionField}) => {
    const {showTraces, diagnostic, text, isPlainText} = props.data;
    return showTraces
      ? DiagnosticsMessageNoHeader({
          message: diagnostic,
          goToLocation: (file: string, line: number) =>
            goToLocation(file, {line}),
          fixer: () => {},
        })
      : DiagnosticsMessageText({
          preserveNewlines: showTraces,
          message: {text, html: isPlainText ? undefined : text},
        });
  };

  _getSortOptions(
    columns: Array<Column<DisplayDiagnostic>>,
  ): {|sortedColumn: ColumnName, sortDescending: boolean|} {
    // If the column the user sorted by has been removed, return the default sorting. We do this
    // (instead of updating the state) so that if the column gets added back we can return to
    // sorting by that.
    const columnKeys = columns.map(column => column.key);
    if (!columnKeys.includes(this.state.sortedColumn)) {
      return {
        sortedColumn: 'classification',
        sortDescending: true,
      };
    }
    // Otherwise, return the sorting they've chosen.
    return {
      sortedColumn: this.state.sortedColumn,
      sortDescending: this.state.sortDescending,
    };
  }

  render(): React.Node {
    const {diagnostics, selectedMessage, showTraces} = this.props;
    const columns = this._getColumns();
    const {sortedColumn, sortDescending} = this._getSortOptions(columns);
    const diagnosticRows = this._getRows(diagnostics, showTraces);
    let sortedRows = this._sortRows(
      diagnosticRows,
      sortedColumn,
      sortDescending,
    );
    let maxResultsMessage;
    if (sortedRows.length > MAX_RESULTS_COUNT) {
      sortedRows = sortedRows.slice(0, MAX_RESULTS_COUNT);
      maxResultsMessage = (
        <div className="highlight-warning diagnostics-ui-table-message">
          Max results ({MAX_RESULTS_COUNT}) reached. Fix diagnostics or show
          only diagnostics for the current file to view more.
        </div>
      );
    }
    const selectedIndex = this._findSelectedIndex(selectedMessage, sortedRows);
    return (
      <div
        className={classnames({
          'diagnostics-ui-table-container': true,
          'diagnostics-ui-table-container-empty': sortedRows.length === 0,
        })}>
        <Table
          ref={table => {
            this._table = table;
          }}
          collapsable={true}
          columns={columns}
          emptyComponent={EmptyComponent}
          fixedHeader={true}
          maxBodyHeight="99999px"
          rows={sortedRows}
          sortable={true}
          onSort={this._handleSort}
          sortedColumn={sortedColumn}
          sortDescending={sortDescending}
          selectable={true}
          selectedIndex={selectedIndex}
          onSelect={this._handleSelectTableRow}
          onConfirm={this._handleConfirmTableRow}
          enableKeyboardNavigation={true}
        />
        {maxResultsMessage}
      </div>
    );
  }

  focus(): void {
    if (this._table != null) {
      this._table.focus();
    }
  }

  _findSelectedIndex(
    selectedMessage: ?DiagnosticMessage,
    rows: Array<Row<DisplayDiagnostic>>,
  ): number {
    if (selectedMessage == null) {
      return -1;
    }

    let bestRank = -1;
    let bestRankedIndex = -1;

    // Look for the closest match, starting with the previously selected index.
    for (const [row, i] of insideOut(rows, this._previousSelectedIndex)) {
      const {diagnostic} = row.data.description;
      if (diagnostic === selectedMessage) {
        bestRankedIndex = i;
        break;
      }
      const rank = compareMessages(diagnostic, selectedMessage);
      if (rank != null && rank > bestRank) {
        bestRank = rank;
        bestRankedIndex = i;
      }
    }

    if (bestRankedIndex === -1) {
      bestRankedIndex = Math.min(this._previousSelectedIndex, rows.length - 1);
    }

    this._previousSelectedIndex = bestRankedIndex;
    return bestRankedIndex;
  }

  _getRows(
    diagnostics: Array<DiagnosticMessage>,
    showTraces: boolean,
  ): Array<Row<DisplayDiagnostic>> {
    const diagnosticsToRows = showTraces
      ? DIAGNOSTICS_TO_ROWS_TRACES_MAP
      : DIAGNOSTICS_TO_ROWS_NO_TRACES_MAP;
    return diagnostics.map(diagnostic => {
      let row = diagnosticsToRows.get(diagnostic);
      if (row == null) {
        const {dir, location} = getLocation(diagnostic);
        row = {
          data: {
            classification: {
              kind: diagnostic.kind || 'lint',
              severity: diagnostic.type,
              stale: diagnostic.stale,
            },
            providerName: diagnostic.providerName,
            description: {
              showTraces,
              diagnostic,
              ...getMessageContent(diagnostic, showTraces),
            },
            dir,
            location,
            diagnostic,
            line: idx(location, _ => _.locationInFile.line),
          },
        };
        diagnosticsToRows.set(diagnostic, row);
      }
      return row;
    });
  }

  // TODO: Memoize this so we don't recompute unnecessarily.
  _sortRows(
    rows: Array<Row<DisplayDiagnostic>>,
    sortedColumn: $Keys<DisplayDiagnostic>,
    descending: boolean,
  ): Array<Row<DisplayDiagnostic>> {
    return sortDiagnostics(rows, sortedColumn, descending);
  }
}

const EmptyComponent = () => (
  <div className="diagnostics-ui-empty-component">No diagnostic messages</div>
);

type Classification = {
  kind: DiagnosticMessageKind,
  severity: DiagnosticMessageType,
  stale?: boolean,
};

function TypeComponent(props: {data: Classification}): React.Element<any> {
  const classification = props.data;
  const iconName = getIconName(classification);
  return (
    <Icon
      icon={iconName}
      className={classification.stale ? 'nuclide-ui-table-type-icon-stale' : ''}
      title={classification.stale ? 'Stale' : ''}
    />
  );
}

function getIconName(classification: Classification): IconName {
  const {kind, severity} = classification;
  if (kind === 'review') {
    return 'nuclicon-comment-discussion';
  }
  invariant(severity !== 'Hint');
  switch (severity) {
    case 'Warning':
      return 'nuclicon-warning';
    case 'Error':
      return 'nuclicon-error';
    case 'Info':
      return 'info';
    default:
      (severity: empty);
      throw new Error(`Invalid severity: ${severity}`);
  }
}

function getMessageContent(
  diagnostic: DiagnosticMessage,
  showTraces: boolean,
): {text: string, isPlainText: boolean} {
  let text = '';
  let isPlainText = true;
  const traces = diagnostic.trace || [];
  const allMessages: Array<{html?: string, text?: string}> = [
    diagnostic,
    ...traces,
  ];
  for (const message of allMessages) {
    // TODO: A mix of html and text diagnostics will yield a wonky sort ordering.
    if (message.html != null) {
      text += message.html + ' ';
      isPlainText = false;
    } else if (message.text != null) {
      text += message.text + ' ';
    } else {
      throw new Error('Neither text nor html property defined on message');
    }
  }
  return {text: text.trim(), isPlainText};
}

function DirComponent(props: {data: string}): React.Element<any> {
  return (
    // We're abusing `direction: rtl` here so we need the LRM to keep the slash on the right.
    <div className="nuclide-diagnostics-ui-dir-cell-contents">
      &lrm;{nuclideUri.normalizeDir(props.data)}&lrm;
    </div>
  );
}

function FilenameComponent(props: {data: ?Location}): React.Element<any> {
  const locationInFile = props.data && props.data.locationInFile;
  if (locationInFile == null) {
    // This is a project diagnostic.
    return <span>{DASH}</span>;
  }
  const {basename, line} = locationInFile;
  return (
    <span>
      {basename}
      <span className="nuclide-diagnostics-ui-line-number">:{line}</span>
    </span>
  );
}

function LineNumberComponent(props: {data: ?number}): React.Element<any> {
  const line = props.data;
  // Show a dash if this is a project diagnostic.
  return <span>{line == null ? DASH : line}</span>;
}

function getLocation(
  diagnostic: DiagnosticMessage,
): {dir: string, location: ?Location} {
  const {filePath, range} = diagnostic;
  const line = range ? range.start.row + 1 : 0;

  const humanized = humanizePath(filePath);
  if (nuclideUri.endsWithSeparator(humanized)) {
    // It's a directory.
    return {
      dir: humanized,
      location: {
        fullPath: filePath,
        locationInFile: null,
      },
    };
  }

  const {dir, base: basename} = nuclideUri.parsePath(humanized);
  return {
    dir,
    location: {
      fullPath: filePath,
      locationInFile: {basename, line},
    },
  };
}

/**
 * Compute a number indicating the relative similarity of two messages. The smaller the number, the
 * more similar. (`null` indicates not at all similar.)
 */
function compareMessages(a: DiagnosticMessage, b: DiagnosticMessage): ?number {
  const aKind = a.kind || 'lint';
  const bKind = b.kind || 'lint';
  const aFilePath = a.filePath;
  const bFilePath = b.filePath;
  if (
    aKind !== bKind ||
    a.providerName !== b.providerName ||
    a.type !== b.type ||
    aFilePath !== bFilePath
  ) {
    return null;
  }
  const aRange = a.range;
  const bRange = b.range;

  if (Boolean(aRange) !== Boolean(bRange)) {
    return null;
  }

  // Neither has a range, but they have the same text and they're for the same file.
  if (aRange == null || bRange == null) {
    return 0;
  }

  // TODO: This could be better if we also took into account the column and end start and column,
  // but it's probably good enough. (How likely are messages with the same text starting on the same
  // row?)
  return Math.abs(aRange.start.row - bRange.start.row);
}

const DASH = '\u2014';
