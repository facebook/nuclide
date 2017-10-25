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
import type {RegExpFilterChange} from 'nuclide-commons-ui/RegExpFilter';

import * as React from 'react';
import {ModalMultiSelect} from '../../../nuclide-ui/ModalMultiSelect';
import {Icon} from 'nuclide-commons-ui/Icon';
import RegExpFilter from 'nuclide-commons-ui/RegExpFilter';
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
  onFilterChange: (change: RegExpFilterChange) => void,
  selectedSourceIds: Array<string>,
  sources: Array<Source>,
  onSelectedSourcesChange: (sourceIds: Array<string>) => void,
  filterText: string,
};

export default class ConsoleHeader extends React.Component<Props> {
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
        className="pull-right nuclide-console-process-control-button"
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
    return (
      <span>
        {option.label}
        {this._renderProcessControlButton(source)}
      </span>
    );
  };

  render(): React.Node {
    const options = this.props.sources
      .slice()
      .sort((a, b) => sortAlpha(a.name, b.name))
      .map(source => ({
        label: source.id,
        value: source.name,
      }));

    const MultiSelectOption = this._renderOption;
    const pasteButton =
      this.props.createPaste == null ? null : (
        <Button
          className="inline-block"
          size={ButtonSizes.SMALL}
          onClick={this._handleCreatePasteButtonClick}
          ref={addTooltip({
            title: 'Creates a Paste from the current contents of the console',
          })}>
          Create Paste
        </Button>
      );

    return (
      <Toolbar location="top">
        <ToolbarLeft>
          <span className="nuclide-console-header-filter-icon inline-block">
            <Icon icon="nuclicon-funnel" />
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
          <RegExpFilter
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
