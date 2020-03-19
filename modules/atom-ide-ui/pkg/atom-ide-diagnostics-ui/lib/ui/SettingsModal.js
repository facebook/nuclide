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

import * as React from 'react';
import BoundSettingsControl from 'nuclide-commons-ui/BoundSettingsControl';
import {HR} from 'nuclide-commons-ui/HR';
import featureConfig from 'nuclide-commons-atom/feature-config';

type Props = {|
  config: Array<SettingsSectionProps>,
|};

type SettingsSectionProps = {|
  providerName: string,
  settings: Array<string>,
|};

export default function SettingsModal(props: Props): React.Node {
  const hasProviderSettings = props.config.some(
    config => config.settings.length > 0,
  );
  return (
    <div className="nuclide-diagnostics-ui-settings-modal settings-view">
      <section className="settings-panel">
        <BoundSettingsControl
          keyPath={featureConfig.formatKeyPath(
            'atom-ide-diagnostics-ui.showDirectoryColumn',
          )}
        />
        <BoundSettingsControl
          keyPath={featureConfig.formatKeyPath(
            'atom-ide-diagnostics-ui.autoVisibility',
          )}
        />
      </section>
      {hasProviderSettings ? <HR /> : null}
      {props.config.map(p => <SettingsSection key={p.providerName} {...p} />)}
    </div>
  );
}

function SettingsSection(props: SettingsSectionProps): React.Node {
  return (
    <section className="settings-panel">
      <h1 className="section-heading">{props.providerName}</h1>
      {props.settings.map(keyPath => (
        <BoundSettingsControl key={keyPath} keyPath={keyPath} />
      ))}
    </section>
  );
}
