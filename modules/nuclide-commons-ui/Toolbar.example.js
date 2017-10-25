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
import {Block} from './Block';
import {Toolbar} from './Toolbar';
import {ToolbarCenter} from './ToolbarCenter';
import {ToolbarLeft} from './ToolbarLeft';
import {ToolbarRight} from './ToolbarRight';
import {Button} from './Button';

const ToolbarExampleLeft = (): React.Element<any> => (
  <div>
    <Block>
      <Toolbar location="top">
        <ToolbarLeft>
          <div>a toolbar can have multiple children,</div>
          <Button>such as this button.</Button>
        </ToolbarLeft>
      </Toolbar>
    </Block>
    <Block>
      <div>
        Be sure to use {'<ToolbarLeft/>, <ToolbarLeft/>, and <ToolbarLeft/>'} as
        children.
      </div>
    </Block>
  </div>
);

const ToolbarExampleCenter = (): React.Element<any> => (
  <Block>
    <Toolbar location="top">
      <ToolbarCenter>
        <div>Example of {'<ToolbarCenter />'}.</div>
      </ToolbarCenter>
    </Toolbar>
  </Block>
);

const ToolbarExampleRight = (): React.Element<any> => (
  <Block>
    <Toolbar location="top">
      <ToolbarRight>
        <div>Example of {'<ToolbarRight />'}</div>
      </ToolbarRight>
    </Toolbar>
  </Block>
);

const ToolbarExampleMultiple = (): React.Element<any> => (
  <Block>
    <Toolbar location="top">
      <ToolbarLeft>
        <div>You can combine</div>
      </ToolbarLeft>
      <ToolbarCenter>
        <div>the various kinds</div>
      </ToolbarCenter>
      <ToolbarRight>
        <div>of aligners.</div>
      </ToolbarRight>
    </Toolbar>
  </Block>
);

export const ToolbarExamples = {
  sectionName: 'Toolbar',
  description: '',
  examples: [
    {
      title: 'Left Toolbar',
      component: ToolbarExampleLeft,
    },
    {
      title: 'Center Toolbar',
      component: ToolbarExampleCenter,
    },
    {
      title: 'Right Toolbar',
      component: ToolbarExampleRight,
    },
    {
      title: 'Combining Toolbar aligners',
      component: ToolbarExampleMultiple,
    },
  ],
};
