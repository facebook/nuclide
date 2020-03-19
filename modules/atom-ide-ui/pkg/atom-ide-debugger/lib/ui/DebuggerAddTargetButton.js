/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import * as React from 'react';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

const DEVICE_PANEL_URL = 'atom://nuclide/devices';

export function AddTargetButton(className: string) {
  return (
    <ButtonGroup className={className}>
      <Dropdown
        className="debugger-stepping-svg-button"
        tooltip={{
          title: 'Start debugging an additional debug target...',
        }}
        options={[
          {label: 'Add target...', value: null, hidden: true},
          {label: 'Attach debugger...', value: 'attach'},
          {label: 'Launch debugger...', value: 'launch'},
          {label: 'Manage devices...', value: 'devices'},
        ]}
        onChange={value => {
          switch (value) {
            case 'attach': {
              atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'debugger:show-attach-dialog',
              );
              break;
            }
            case 'launch': {
              atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'debugger:show-launch-dialog',
              );
              break;
            }
            case 'devices': {
              goToLocation(DEVICE_PANEL_URL);
              break;
            }
            default:
              break;
          }
        }}
      />
    </ButtonGroup>
  );
}
