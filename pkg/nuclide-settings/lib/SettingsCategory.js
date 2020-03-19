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

import * as React from 'react';
import SettingsControl from 'nuclide-commons-ui/SettingsControl';

type Props = {
  name: string,
  packages: Object,
};

export default class SettingsCategory extends React.Component<Props> {
  render(): React.Node {
    const children = Object.keys(this.props.packages)
      .sort()
      .map(pkgName => {
        const pkgData = this.props.packages[pkgName];
        const settingsArray = getSortedSettingsArray(pkgData.settings, pkgName);
        const elements = settingsArray.map(settingName => {
          const settingData = pkgData.settings[settingName];
          return (
            <ControlGroup key={settingName}>
              <SettingsControl
                keyPath={settingData.keyPath}
                title={settingData.title}
                value={settingData.value}
                onChange={settingData.onChange}
                schema={settingData.schema}
              />
            </ControlGroup>
          );
        });
        // We create a control group for the whole group of controls and then another for each
        // individual one. Why? Because that's what Atom does in its settings view.
        return (
          <ControlGroup key={pkgName}>
            <section className="sub-section">
              {/* Package title. */}
              <h2 className="sub-section-heading">{pkgData.title}</h2>
              <div className="sub-section-body">{elements}</div>
            </section>
          </ControlGroup>
        );
      });
    return (
      <section className="section settings-panel">
        {/* Category Title */}
        <h1 className="block section-heading icon icon-gear">
          {this.props.name} Settings
        </h1>
        {children}
      </section>
    );
  }
}

// $FlowFixMe(>=0.53.0) Flow suppress
function ControlGroup(props: {children?: React.Children}): React.Element<any> {
  return (
    <div className="control-group">
      <div className="controls">{props.children}</div>
    </div>
  );
}

function getSortedSettingsArray(
  settings: Object,
  pkgName: string,
): Array<string> {
  // Sort the package's settings by name, then by order.
  const settingsArray = Object.keys(settings);
  settingsArray.sort().sort((a, b) => settings[a].order - settings[b].order);
  return settingsArray;
}
