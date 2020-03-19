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

import type {MenuItem} from 'nuclide-commons-ui/Dropdown';
import type {LanguageStatusProvider, StatusKind} from './types';

import makeTooltip from './Tooltip';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import * as React from 'react';

type Props = {
  onUpdateSettings: (newSettings: Map<string, StatusKind>) => void,
  providers: Array<LanguageStatusProvider>,
  settings: Map<string, StatusKind>,
  tooltipRoot: HTMLElement,
};

// following values must match LanguageStatusPreference exactly
const dropdownLabels: Map<StatusKind, string> = new Map([
  ['green', 'show always'],
  ['yellow', 'show on progress'],
  ['red', 'show only on errors'],
  ['null', 'hide'],
]);
const dropdownItems: Array<MenuItem> = Array.from(dropdownLabels).map(
  ([value, label]) => ({value, label}),
);

class SettingsTooltipComponent extends React.PureComponent<Props> {
  render(): React.Node {
    const relevantProviders = [...this.props.settings.entries()]
      .map(([name]) =>
        this.props.providers.find(provider => provider.name === name),
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.priority === b.priority
            ? a.name.localeCompare(b.name)
            : b.priority - a.priority,
      );
    this._styleTooltip();
    const servers = relevantProviders.map(provider => {
      return (
        <p
          className="nuclide-language-status-settings-item"
          key={provider.name}>
          {provider.name}:{' '}
          <Dropdown
            onChange={newKind => this._updateSettings(provider, newKind)}
            className="nuclide-language-status-settings-dropdown"
            isFlat={true}
            options={dropdownItems}
            value={this.props.settings.get(provider.name)}
          />
        </p>
      );
    });
    return (
      <div className="nuclide-language-status-tooltip-content">
        <p>Language Status Settings:</p>
        <hr />
        {servers}
      </div>
    );
  }

  _styleTooltip(): void {
    const {tooltipRoot} = this.props;
    if (tooltipRoot != null) {
      tooltipRoot.classList.add('nuclide-language-status-tooltip-settings');
    }
  }

  _updateSettings(provider: LanguageStatusProvider, newKind: StatusKind): void {
    const newSettings = new Map(this.props.settings);
    newSettings.set(provider.name, newKind);
    this.props.onUpdateSettings(newSettings);
  }
}

const SettingsTooltip = makeTooltip(SettingsTooltipComponent);
export default SettingsTooltip;
