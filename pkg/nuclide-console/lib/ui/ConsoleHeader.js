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

import type {Source} from '../types';

import classnames from 'classnames';
import React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {FunnelIcon} from './FunnelIcon';
import {ModalMultiSelect} from '../../../nuclide-ui/ModalMultiSelect';
import {Toolbar} from 'nuclide-commons-ui/Toolbar';
import {ToolbarLeft} from 'nuclide-commons-ui/ToolbarLeft';
import {ToolbarRight} from 'nuclide-commons-ui/ToolbarRight';
import addTooltip from 'nuclide-commons-ui/addTooltip';

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import invariant from 'assert';

type Props = {
  clear: () => void,
  createPaste: ?() => Promise<void>,
  invalidFilterInput: boolean,
  enableRegExpFilter: boolean,
  selectedSourceIds: Array<string>,
  sources: Array<Source>,
  onFilterTextChange: (filterText: string) => void,
  toggleRegExpFilter: () => void,
  onSelectedSourcesChange: (sourceIds: Array<string>) => void,
  filterText: string,
};

export default class ConsoleHeader extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
    (this: any)._handleClearButtonClick = this._handleClearButtonClick.bind(
      this,
    );
    (this: any)._handleCreatePasteButtonClick = this._handleCreatePasteButtonClick.bind(
      this,
    );
    (this: any)._handleReToggleButtonClick = this._handleReToggleButtonClick.bind(
      this,
    );
    (this: any)._renderOption = this._renderOption.bind(this);
  }

  _handleClearButtonClick(event: SyntheticMouseEvent): void {
    this.props.clear();
  }

  _handleCreatePasteButtonClick(event: SyntheticMouseEvent): void {
    if (this.props.createPaste != null) {
      this.props.createPaste();
    }
  }

  _handleReToggleButtonClick(): void {
    this.props.toggleRegExpFilter();
  }

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
      <Button className="pull-right" icon={icon} onClick={clickHandler}>
        {label}
      </Button>
    );
  }

  _renderOption(optionProps: {
    option: {label: string, value: string},
  }): React.Element<any> {
    const {option} = optionProps;
    const source = this.props.sources.find(s => s.id === option.value);
    invariant(source != null);
    return (
      <span>
        {option.label}
        {this._renderProcessControlButton(source)}
      </span>
    );
  }

  render(): ?React.Element<any> {
    const options = this.props.sources
      .slice()
      .sort((a, b) => sortAlpha(a.name, b.name))
      .map(source => ({
        label: source.id,
        value: source.name,
      }));

    const filterInputClassName = classnames('nuclide-console-filter-field', {
      invalid: this.props.invalidFilterInput,
    });

    const MultiSelectOption = this._renderOption;
    const pasteButton = this.props.createPaste == null
      ? null
      : <Button
          className="inline-block"
          size={ButtonSizes.SMALL}
          onClick={this._handleCreatePasteButtonClick}
          ref={addTooltip({
            title: 'Creates a Paste from the current contents of the console',
          })}>
          Create Paste
        </Button>;

    return (
      <Toolbar location="top">
        <ToolbarLeft>
          <span className="nuclide-console-header-filter-icon inline-block">
            <FunnelIcon />
          </span>
          <ModalMultiSelect
            labelComponent={MultiSelectLabel}
            optionComponent={MultiSelectOption}
            size={ButtonSizes.SMALL}
            options={options}
            value={this.props.selectedSourceIds}
            onChange={this.props.onSelectedSourcesChange}
            className="inline-block"
          />
          <ButtonGroup className="inline-block">
            <AtomInput
              className={filterInputClassName}
              size="sm"
              width={200}
              placeholderText="Filter"
              onDidChange={this.props.onFilterTextChange}
              value={this.props.filterText}
            />
            <Button
              className="nuclide-console-filter-regexp-button"
              size={ButtonSizes.SMALL}
              selected={this.props.enableRegExpFilter}
              onClick={this._handleReToggleButtonClick}
              tooltip={{title: 'Use Regex'}}>
              .*
            </Button>
          </ButtonGroup>
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
  const label = selectedOptions.length === 1
    ? selectedOptions[0].label
    : `${selectedOptions.length} Sources`;
  return <span>Showing: {label}</span>;
}
