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
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Column, Row} from 'nuclide-commons-ui/Table';
import type {IconName} from 'nuclide-commons-ui/Icon';

import classnames from 'classnames';
import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import humanizePath from 'nuclide-commons-atom/humanizePath';
import {insideOut} from 'nuclide-commons/collection';
import * as React from 'react';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {Table} from 'nuclide-commons-ui/Table';
import sortDiagnostics from '../sortDiagnostics';
import {DiagnosticsMessageNoHeader} from './DiagnosticsMessage';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';
import {Icon} from 'nuclide-commons-ui/Icon';
import {Subject, BehaviorSubject} from 'rxjs';

// text is always used for sorting, while we render the element.
type DescriptionField = {
  diagnostic: DiagnosticMessage,
  showTraces: boolean,
  text: string,
  isPlainText: boolean,
};

type Location = {|
  fullPath: NuclideUri,
  locationInFile: ?{|
    basename: string,
    line: number,
  |},
|};

export type DisplayDiagnostic = {
  +classification: {
    kind: DiagnosticMessageKind,
    severity: DiagnosticMessageType,
  },
  +providerName: string,
  +description: {
    showTraces: boolean,
    diagnostic: DiagnosticMessage,
    text: string,
    isPlainText: boolean,
  },
  +dir: string,
  +location: ?Location,
};

type ColumnName = $Keys<DisplayDiagnostic>;

// Maximum number of results to render in the table before truncating and displaying a "Max results
// reached" message.
const MAX_RESULTS_COUNT = 1000;

type Props = {
  diagnostics: Array<DiagnosticMessage>,
  selectedMessage: ?DiagnosticMessage,
  gotoMessageLocation: (
    message: DiagnosticMessage,
    options: {|focusEditor: boolean|},
  ) => void,
  selectMessage: (message: DiagnosticMessage) => void,
  showFileName: ?boolean,
  showDirectoryColumn: boolean,
  showTraces: boolean,
};

type State = {
  focused: boolean,
  selectedMessage: ?DiagnosticMessage,
  sortDescending: boolean,
  sortedColumn: ColumnName,
};

export default class DiagnosticsTable extends React.PureComponent<
  Props,
  State,
> {
  _previousSelectedIndex: number = -1;
  _table: ?Table<DisplayDiagnostic>;
  _focusChangeEvents: Subject<SyntheticEvent<*>> = new Subject();
  _selectedMessages: BehaviorSubject<?DiagnosticMessage> = new BehaviorSubject();
  _disposables: ?UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {
      focused: false,
      selectedMessage: null,
      sortDescending: true,
      sortedColumn: 'classification',
    };
  }

  componentWillReceiveProps(nextProps: Props): void {
    this._selectedMessages.next(nextProps.selectedMessage);
  }

  componentDidMount(): void {
    const focusedStream = this._focusChangeEvents.map(
      event => event.type === 'focus',
    );
    this._disposables = new UniversalDisposable(
      // If we change the state synchronously on the focus change, the component will be
      // re-rendered, removing the element with the click handler before the click event gets to us
      // (via the table's `onSelect()`). This would manifest itself in rows not being selected when
      // a click both changes the selection and focuses the table. A naive solution would be to
      // simply delay the focus event, however, users would perceive the selection and focus styling
      // changes (quick flashing changes). Therefore, we hold onto focus changes (i.e. don't
      // re-render) until we hear the selection change. Because a focus change may occur without a
      // subsequent selection change, we also always force a re-render after a certain number of
      // milliseconds without hearing a selection change. The end result is that clicking a row when
      // the table is not focused will immediately render the table with the correct focus and
      // selection. Focusing the table without clicking a row will be queue a re-render in a few
      // milliseconds.
      this._selectedMessages
        .distinctUntilChanged()
        .withLatestFrom(focusedStream)
        .subscribe(([selectedMessage, focused]) => {
          this.setState({selectedMessage, focused});
        }),
      focusedStream.delay(100).subscribe(focused => this.setState({focused})),
    );
  }

  componentWillUnmount(): void {
    invariant(this._disposables != null);
    this._disposables.dispose();
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
    this.props.gotoMessageLocation(item.diagnostic, {focusEditor: false});
  };

  _handleConfirmTableRow = (item: {diagnostic: DiagnosticMessage}): void => {
    this.props.gotoMessageLocation(item.diagnostic, {focusEditor: true});
  };

  _getColumns(): Array<Column<DisplayDiagnostic>> {
    const {showFileName, showDirectoryColumn} = this.props;

    // These need to add up to 1.
    // TODO: Update the Table component so that we can have more control over this (and provide
    //       explicit pixel widths)
    const TYPE_WIDTH = 0.05;
    const SOURCE_WIDTH = 0.1;
    const FILENAME_WIDTH = 0.3;
    const DIR_WIDTH = 0.15;

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
    }

    // False positive for this lint rule?
    // eslint-disable-next-line react/no-unused-prop-types
    const DescriptionComponent = (props: {data: DescriptionField}) => {
      const {showTraces, diagnostic, text, isPlainText} = props.data;
      const expanded =
        showTraces ||
        (this.state.focused && diagnostic === this.state.selectedMessage);
      return expanded
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
        minWidth: 70,
      },
      {
        component: DescriptionComponent,
        key: 'description',
        title: 'Description',
        width: descriptionWidth,
        cellClassName: 'nuclide-diagnostics-ui-cell-description',
      },
      ...filePathColumns,
    ];
  }

  render(): React.Node {
    const {diagnostics, showTraces} = this.props;
    const {selectedMessage, sortedColumn, sortDescending} = this.state;
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
          onBodyFocus={this._handleFocusChangeEvent}
          onBodyBlur={this._handleFocusChangeEvent}
          collapsable={true}
          columns={this._getColumns()}
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

  _handleFocusChangeEvent = (event: SyntheticEvent<*>): void => {
    this._focusChangeEvents.next(event);
  };

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

  // TODO: Memoize this so we don't recompute unnecessarily.
  _getRows(
    diagnostics: Array<DiagnosticMessage>,
    showTraces: boolean,
  ): Array<Row<DisplayDiagnostic>> {
    return diagnostics.map(diagnostic => {
      const {dir, location} = getLocation(diagnostic);
      return {
        data: {
          classification: {
            kind: diagnostic.kind || 'lint',
            severity: diagnostic.type,
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
        },
      };
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
};

function TypeComponent(props: {data: Classification}): React.Element<any> {
  const classification = props.data;
  const iconName = getIconName(classification);
  return <Icon icon={iconName} />;
}

function getIconName(classification: Classification): IconName {
  const {kind, severity} = classification;
  if (kind === 'review') {
    return 'nuclicon-comment-discussion';
  }
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
    return <span>&mdash;</span>;
  }
  const {basename, line} = locationInFile;
  return (
    <span>
      {basename}
      <span className="nuclide-diagnostics-ui-line-number">:{line}</span>
    </span>
  );
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
