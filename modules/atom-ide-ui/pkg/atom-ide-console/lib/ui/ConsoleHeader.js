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

import type {Source, Severity} from '../types';
import type {RegExpFilterChange} from 'nuclide-commons-ui/RegExpFilter';

import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import * as React from 'react';
import {ModalMultiSelect} from 'nuclide-commons-ui/ModalMultiSelect';
import RegExpFilter from 'nuclide-commons-ui/RegExpFilter';
import {Toolbar} from 'nuclide-commons-ui/Toolbar';
import {ToolbarLeft} from 'nuclide-commons-ui/ToolbarLeft';
import {ToolbarRight} from 'nuclide-commons-ui/ToolbarRight';
import addTooltip from 'nuclide-commons-ui/addTooltip';

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import invariant from 'assert';

type Props = {|
  clear: () => void,
  createPaste: ?() => Promise<void>,
  invalidFilterInput: boolean,
  enableRegExpFilter: boolean,
  onFilterChange: (change: RegExpFilterChange) => void,
  selectedSourceIds: Array<string>,
  sources: Array<Source>,
  onSelectedSourcesChange: (sourceIds: Array<string>) => void,
  filterText: string,
  selectedSeverities: Set<Severity>,
  toggleSeverity: (severity: Severity) => void,
|};

export default class ConsoleHeader extends React.Component<Props> {
  _filterComponent: ?RegExpFilter;

  focusFilter = (): void => {
    if (this._filterComponent != null) {
      this._filterComponent.focus();
    }
  };

  _handleClearButtonClick = (event: SyntheticMouseEvent<>): void => {
    this.props.clear();
  };

  _handleCreatePasteButtonClick = (event: SyntheticMouseEvent<>): void => {
    if (this.props.createPaste != null) {
      this.props.createPaste();
    }
  };

  _handleFilterChange = (value: RegExpFilterChange): void => {
    this.props.onFilterChange(value);
  };

  _renderProcessControlButton(source: Source): ?React.Element<any> {
    let action;
    let label;
    let icon;
    switch (source.status) {
      case 'starting':
      case 'running': {
        action = source.stop;
        label = 'Stop Process';
        icon = 'primitive-square';
        break;
      }
      case 'stopped': {
        action = source.start;
        label = 'Start Process';
        icon = 'triangle-right';
        break;
      }
    }
    if (action == null) {
      return;
    }
    const clickHandler = event => {
      event.stopPropagation();
      invariant(action != null);
      action();
    };
    return (
      <Button
        className="pull-right console-process-control-button"
        icon={icon}
        onClick={clickHandler}>
        {label}
      </Button>
    );
  }

  _renderOption = (optionProps: {
    option: {label: string, value: string},
  }): React.Element<any> => {
    const {option} = optionProps;
    const source = this.props.sources.find(s => s.id === option.value);
    invariant(source != null);
    const startingSpinner =
      source.status !== 'starting' ? null : (
        <LoadingSpinner
          className="inline-block console-process-starting-spinner"
          size="EXTRA_SMALL"
        />
      );
    return (
      <span>
        {option.label}
        {startingSpinner}
        {this._renderProcessControlButton(source)}
      </span>
    );
  };

  render(): React.Node {
    const options = this.props.sources
      .slice()
      .sort((a, b) => sortAlpha(a.name, b.name))
      .map(source => ({
        label: source.name,
        value: source.id,
      }));

    const sourceButton =
      options.length === 0 ? null : (
        <ModalMultiSelect
          labelComponent={MultiSelectLabel}
          optionComponent={this._renderOption}
          size={ButtonSizes.SMALL}
          options={options}
          value={this.props.selectedSourceIds}
          onChange={this.props.onSelectedSourcesChange}
          className="inline-block"
        />
      );

    const pasteButton =
      this.props.createPaste == null ? null : (
        <Button
          className="inline-block"
          size={ButtonSizes.SMALL}
          onClick={this._handleCreatePasteButtonClick}
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={addTooltip({
            title: 'Creates a Paste from the current contents of the console',
          })}>
          Create Paste
        </Button>
      );

    return (
      <Toolbar location="top">
        <ToolbarLeft>
          {sourceButton}
          <ButtonGroup className="inline-block">
            <FilterButton
              severity="error"
              selectedSeverities={this.props.selectedSeverities}
              toggleSeverity={this.props.toggleSeverity}
            />
            <FilterButton
              severity="warning"
              selectedSeverities={this.props.selectedSeverities}
              toggleSeverity={this.props.toggleSeverity}
            />
            <FilterButton
              severity="info"
              selectedSeverities={this.props.selectedSeverities}
              toggleSeverity={this.props.toggleSeverity}
            />
          </ButtonGroup>
          <RegExpFilter
            ref={component => (this._filterComponent = component)}
            value={{
              text: this.props.filterText,
              isRegExp: this.props.enableRegExpFilter,
              invalid: this.props.invalidFilterInput,
            }}
            onChange={this._handleFilterChange}
          />
        </ToolbarLeft>
        <ToolbarRight>
          {pasteButton}
          <Button
            size={ButtonSizes.SMALL}
            onClick={this._handleClearButtonClick}>
            Clear
          </Button>
        </ToolbarRight>
      </Toolbar>
    );
  }
}

function sortAlpha(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower < bLower) {
    return -1;
  } else if (aLower > bLower) {
    return 1;
  }
  return 0;
}

type LabelProps = {
  selectedOptions: Array<{value: string, label: string}>,
};

function MultiSelectLabel(props: LabelProps): React.Element<any> {
  const {selectedOptions} = props;
  const label =
    selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} Sources`;
  return <span>Showing: {label}</span>;
}

type FilterButtonProps = {|
  severity: 'error' | 'warning' | 'info',
  selectedSeverities: Set<Severity>,
  toggleSeverity: Severity => void,
|};

function FilterButton(props: FilterButtonProps): React.Element<any> {
  const {severity} = props;
  const selected = props.selectedSeverities.has(props.severity);
  let tooltipTitle = selected ? 'Hide ' : 'Show ';
  let icon;
  switch (severity) {
    case 'error':
      tooltipTitle += 'Errors';
      icon = 'nuclicon-error';
      break;
    case 'warning':
      tooltipTitle += 'Warnings';
      icon = 'nuclicon-warning';
      break;
    case 'info':
      tooltipTitle += 'Info';
      icon = 'info';
      break;
    default:
      (severity: empty);
      throw new Error(`Invalid severity: ${severity}`);
  }

  return (
    <Button
      icon={icon}
      size={ButtonSizes.SMALL}
      selected={props.selectedSeverities.has(severity)}
      onClick={() => {
        props.toggleSeverity(severity);
      }}
      tooltip={{title: tooltipTitle}}
    />
  );
}
