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
import {Block} from './Block';
import PulseButtonWithTooltip from './PulseButtonWithTooltip';

type State = {dismissed: boolean};

class Example extends React.Component<{}, State> {
  render(): React.Node {
    return (
      <div>
        <Block>
          <div
            style={{
              height: 100,
              width: '100%',
              display: 'flex',
            }}>
            <PulseButtonWithTooltip
              ariaLabel="New feature!"
              wrapperStyle={{margin: 'auto'}}
              tooltipText="Look I'm a tooltip!"
            />
          </div>
        </Block>
      </div>
    );
  }
}

export const PulseButtonExample = {
  sectionName: 'PulseButton',
  description: 'A glowing button that often triggers a dismissable tooltip',
  examples: [
    {
      title: 'PulseButton',
      component: Example,
    },
  ],
};
