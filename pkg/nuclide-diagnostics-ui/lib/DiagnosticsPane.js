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

import type {DiagnosticMessage} from '../../nuclide-diagnostics-common';
import type {Column} from '../../nuclide-ui/Table';

import classnames from 'classnames';
import React from 'react';
import {goToLocation} from '../../commons-atom/go-to-location';
import {track} from '../../nuclide-analytics';
import {Table} from '../../nuclide-ui/Table';
import {Highlight, HighlightColors} from '../../nuclide-ui/Highlight';
import {sortDiagnostics} from './DiagnosticsSorter';
import {getProjectRelativePathOfDiagnostic} from './paneUtils';
import {DiagnosticsMessageNoHeader} from '../../nuclide-ui/DiagnosticsMessage';

// text is always used for sorting.
// Precedence for rendering is: element, html, text.
type DescriptionField = {
  text: string,
  html: ?string,
  element: ?React.Element<any>,
};

export type DisplayDiagnostic = {
  +type: string,
  +providerName: string,
  +filePath: string,
  +range: number,
  +description: DescriptionField,
  +diagnostic: DiagnosticMessage,
};

// Maximum number of results to render in the table before truncating and displaying a "Max results
// reached" message.
const MAX_RESULTS_COUNT = 1000;

const EmptyComponent = () => (
  <div className="nuclide-diagnostics-ui-empty-component">
    No diagnostic messages
  </div>
);

const TypeToHighlightColor = Object.freeze({
  ERROR: HighlightColors.error,
  WARNING: HighlightColors.warning,
  INFO: HighlightColors.info,
});

function TypeComponent(props: {
  data: 'Warning' | 'Error' | 'Info',
}): React.Element<any> {
  const text = props.data;
  const highlightColor = TypeToHighlightColor[text.toUpperCase()];
  return <Highlight color={highlightColor}>{text}</Highlight>;
}

/** @return text and a boolean indicating whether it is plaintext or HTML. */
function getMessageContent(
  showTraces: boolean,
  diagnostic: DiagnosticMessage,
): DescriptionField {
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
  return {
    text: text.trim(),
    html: isPlainText ? null : text.trim(),
    element: showTraces && diagnostic.scope === 'file'
      ? DiagnosticsMessageNoHeader({
          message: diagnostic,
          goToLocation,
          fixer: () => {},
        })
      : null,
  };
}

function DescriptionComponent(props: {
  data: DescriptionField,
}): React.Element<any> {
  const message = props.data;
  if (message.element != null) {
    return message.element;
  } else if (message.html != null) {
    return <span dangerouslySetInnerHTML={{__html: message.text}} />;
  } else {
    return <span>{message.text}</span>;
  }
}

function goToDiagnosticLocation(rowData: DiagnosticMessage): void {
  if (rowData.scope !== 'file' || rowData.filePath == null) {
    return;
  }

  track('diagnostics-panel-goto-location');

  const uri = rowData.filePath;
  // If initialLine is N, Atom will navigate to line N+1.
  // Flow sometimes reports a row of -1, so this ensures the line is at least one.
  const line = Math.max(rowData.range ? rowData.range.start.row : 0, 0);
  const column = 0;
  goToLocation(uri, line, column);
}

type DiagnosticsPaneProps = {
  diagnostics: Array<DiagnosticMessage>,
  showFileName: ?boolean,
  showTraces: boolean,
};

export default class DiagnosticsPane extends React.Component {
  props: DiagnosticsPaneProps;
  state: {
    sortDescending: boolean,
    sortedColumn: ?string,
  };

  constructor(props: DiagnosticsPaneProps) {
    super(props);
    (this: any)._handleSort = this._handleSort.bind(this);
    (this: any)._handleSelectTableRow = this._handleSelectTableRow.bind(this);
    this.state = {
      sortDescending: false,
      sortedColumn: null,
    };
  }

  _handleSort(sortedColumn: ?string, sortDescending: boolean): void {
    this.setState({
      sortedColumn,
      sortDescending,
    });
  }

  _handleSelectTableRow(
    item: {diagnostic: DiagnosticMessage},
    selectedIndex: number,
  ): void {
    goToDiagnosticLocation(item.diagnostic);
  }

  _getColumns(): Array<Column> {
    const {showFileName} = this.props;
    const filePathColumnWidth = 0.2;
    const filePathColumn = showFileName
      ? [
          {
            key: 'filePath',
            title: 'File',
            width: filePathColumnWidth,
          },
        ]
      : [];
    return [
      {
        component: TypeComponent,
        key: 'type',
        title: 'Type',
        width: 0.05,
      },
      {
        key: 'providerName',
        title: 'Source',
        width: 0.1,
      },
      ...filePathColumn,
      {
        key: 'range',
        title: 'Line',
        width: 0.05,
        textAlignRight: true,
      },
      {
        component: DescriptionComponent,
        key: 'description',
        title: 'Description',
        width: showFileName ? 0.6 : 0.6 + filePathColumnWidth,
      },
    ];
  }

  render(): React.Element<any> {
    const {diagnostics, showTraces} = this.props;
    const {sortedColumn, sortDescending} = this.state;
    const diagnosticRows = diagnostics.map(diagnostic => {
      const messageContent = getMessageContent(showTraces, diagnostic);
      return {
        data: {
          type: diagnostic.type,
          providerName: diagnostic.providerName,
          filePath: getProjectRelativePathOfDiagnostic(diagnostic),
          range: diagnostic.range ? diagnostic.range.start.row + 1 : 0,
          description: messageContent,
          diagnostic,
        },
      };
    });
    let sortedRows = sortDiagnostics(
      diagnosticRows,
      sortedColumn,
      sortDescending,
    );
    let maxResultsMessage;
    if (sortedRows.length > MAX_RESULTS_COUNT) {
      sortedRows = sortedRows.slice(0, MAX_RESULTS_COUNT);
      maxResultsMessage = (
        <div className="highlight-warning nuclide-diagnostics-ui-table-message">
          Max results ({MAX_RESULTS_COUNT}) reached.
          Fix diagnostics or show only diagnostics for the current file to view more.
        </div>
      );
    }
    return (
      <div
        className={classnames({
          'nuclide-diagnostics-ui-table-container': true,
          'nuclide-diagnostics-ui-table-container-empty': sortedRows.length ===
            0,
        })}>
        <Table
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
          onSelect={this._handleSelectTableRow}
        />
        {maxResultsMessage}
      </div>
    );
  }
}
