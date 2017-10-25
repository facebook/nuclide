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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  DiagnosticMessage,
  DiagnosticMessageKind,
  UiConfig,
} from '../../../atom-ide-diagnostics/lib/types';
import type {DiagnosticGroup} from '../types';
import type {
  RegExpFilterChange,
  RegExpFilterValue,
} from 'nuclide-commons-ui/RegExpFilter';

import analytics from 'nuclide-commons-atom/analytics';
import DiagnosticsTable from './DiagnosticsTable';
import showModal from 'nuclide-commons-ui/showModal';
import {Toggle} from 'nuclide-commons-ui/Toggle';
import {Toolbar} from 'nuclide-commons-ui/Toolbar';
import {ToolbarLeft} from 'nuclide-commons-ui/ToolbarLeft';
import {ToolbarRight} from 'nuclide-commons-ui/ToolbarRight';
import * as React from 'react';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import FilterButton from './FilterButton';
import RegExpFilter from 'nuclide-commons-ui/RegExpFilter';
import SettingsModal from './SettingsModal';

export type Props = {
  diagnostics: Array<DiagnosticMessage>,
  pathToActiveTextEditor: ?NuclideUri,
  filterByActiveTextEditor: boolean,
  onFilterByActiveTextEditorChange: (isChecked: boolean) => mixed,
  showDirectoryColumn: boolean,
  showTraces: boolean,
  onShowTracesChange: (isChecked: boolean) => mixed,
  gotoMessageLocation: (
    message: DiagnosticMessage,
    options: {|focusEditor: boolean|},
  ) => void,
  selectMessage: (message: DiagnosticMessage) => void,
  selectedMessage: ?DiagnosticMessage,
  supportedMessageKinds: Set<DiagnosticMessageKind>,
  uiConfig: UiConfig,
  isVisible: boolean,
  // Used by the DiagnosticsViewModel.
  autoVisibility: boolean, // eslint-disable-line react/no-unused-prop-types

  hiddenGroups: Set<DiagnosticGroup>,
  onTypeFilterChange: (type: DiagnosticGroup) => mixed,
  textFilter: RegExpFilterValue,
  onTextFilterChange: (change: RegExpFilterChange) => mixed,
};

/**
 * Dismissable panel that displays the diagnostics from nuclide-diagnostics-store.
 */
export default class DiagnosticsView extends React.Component<Props> {
  _table: ?DiagnosticsTable;

  shouldComponentUpdate(nextProps: Props): boolean {
    return nextProps.isVisible;
  }

  render(): React.Element<any> {
    let {diagnostics} = this.props;
    const {showDirectoryColumn, showTraces} = this.props;
    if (this.props.filterByActiveTextEditor) {
      const pathToFilterBy = this.props.pathToActiveTextEditor;
      if (pathToFilterBy != null) {
        diagnostics = diagnostics.filter(
          diagnostic => diagnostic.filePath === pathToFilterBy,
        );
      } else {
        // Current pane is not a text editor; do not show diagnostics.
        diagnostics = [];
      }
    }

    const groups = ['errors', 'warnings', 'info'];
    if (this.props.supportedMessageKinds.has('review')) {
      groups.push('review');
    }

    const showFullDescriptionToggle = diagnostics.find(
      diagnostic =>
        // flowlint-next-line sketchy-null-string:off
        diagnostic.trace || (diagnostic.text && diagnostic.text.includes('\n')),
    );

    return (
      <div
        onFocus={this._handleFocus}
        tabIndex={-1}
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          width: '100%',
        }}>
        <Toolbar location="top">
          <ToolbarLeft>
            <ButtonGroup className="inline-block">
              {groups.map(group => (
                <FilterButton
                  key={group}
                  group={group}
                  selected={!this.props.hiddenGroups.has(group)}
                  onClick={() => {
                    this.props.onTypeFilterChange(group);
                  }}
                />
              ))}
            </ButtonGroup>
            <RegExpFilter
              value={this.props.textFilter}
              onChange={this.props.onTextFilterChange}
            />
            {/* TODO: This will probably change to a dropdown to also accomodate Head Changes */}
            <Toggle
              className="inline-block"
              onChange={this._handleFilterByActiveTextEditorChange}
              toggled={this.props.filterByActiveTextEditor}
              label="Current File Only"
            />
          </ToolbarLeft>
          <ToolbarRight>
            {showFullDescriptionToggle ? (
              <Toggle
                className="inline-block"
                onChange={this._handleShowTracesChange}
                toggled={this.props.showTraces}
                label="Full Description"
              />
            ) : null}
            <Button
              onClick={this._openAllFilesWithErrors}
              size={ButtonSizes.SMALL}
              disabled={diagnostics.length === 0}
              className="inline-block"
              title="Open All">
              Open All
            </Button>
            <Button
              icon="gear"
              size={ButtonSizes.SMALL}
              onClick={this._showSettings}
            />
          </ToolbarRight>
        </Toolbar>
        <DiagnosticsTable
          ref={table => {
            this._table = table;
          }}
          showFileName={!this.props.filterByActiveTextEditor}
          diagnostics={diagnostics}
          showDirectoryColumn={showDirectoryColumn}
          showTraces={showTraces}
          selectedMessage={this.props.selectedMessage}
          selectMessage={this.props.selectMessage}
          gotoMessageLocation={this.props.gotoMessageLocation}
        />
      </div>
    );
  }

  _showSettings = (): void => {
    showModal(() => <SettingsModal config={this.props.uiConfig} />);
  };

  _handleShowTracesChange = (isChecked: boolean): void => {
    analytics.track('diagnostics-panel-toggle-show-traces', {
      isChecked: isChecked.toString(),
    });
    this.props.onShowTracesChange.call(null, isChecked);
  };

  _handleFilterByActiveTextEditorChange = (shouldFilter: boolean): void => {
    analytics.track('diagnostics-panel-toggle-current-file', {
      isChecked: shouldFilter.toString(),
    });
    this.props.onFilterByActiveTextEditorChange.call(null, shouldFilter);
  };

  _openAllFilesWithErrors = (): void => {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'diagnostics:open-all-files-with-errors',
    );
  };

  _handleFocus = (event: SyntheticMouseEvent<*>): void => {
    if (this._table == null) {
      return;
    }
    let el = event.target;
    while (el != null) {
      if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
        return;
      }
      el = (el: any).parentElement;
    }
    this._table.focus();
  };
}
