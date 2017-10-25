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
import {Button} from './Button';
import {ButtonGroup} from './ButtonGroup';
import {ButtonToolbar} from './ButtonToolbar';
import {Block} from './Block';

const ButtonSizeExample = (): React.Element<any> => (
  <Block>
    <Button className="inline-block" size="EXTRA_SMALL">
      extra_small
    </Button>
    <Button className="inline-block" size="SMALL">
      small
    </Button>
    <Button className="inline-block">regular</Button>
    <Button className="inline-block" size="LARGE">
      large
    </Button>
  </Block>
);

const ButtonDisabledExample = (): React.Element<any> => (
  <Block>
    <Button className="inline-block">enabled</Button>
    <Button className="inline-block" disabled={true}>
      disabled
    </Button>
  </Block>
);

const ButtonColorExample = (): React.Element<any> => (
  <div>
    <Block>
      <ButtonGroup>
        <Button buttonType="PRIMARY">primary</Button>
        <Button buttonType="INFO">info</Button>
        <Button buttonType="SUCCESS">success</Button>
        <Button buttonType="WARNING">warning</Button>
        <Button buttonType="ERROR">error</Button>
      </ButtonGroup>
    </Block>
    <Block>
      <p>selected:</p>
      <ButtonGroup>
        <Button selected={true} buttonType="PRIMARY">
          primary
        </Button>
        <Button selected={true} buttonType="INFO">
          info
        </Button>
        <Button selected={true} buttonType="SUCCESS">
          success
        </Button>
        <Button selected={true} buttonType="WARNING">
          warning
        </Button>
        <Button selected={true} buttonType="ERROR">
          error
        </Button>
      </ButtonGroup>
    </Block>
  </div>
);

const ButtonIconExample = (): React.Element<any> => (
  <Block>
    <ButtonGroup>
      <Button icon="gear" />
      <Button icon="cloud-download" />
      <Button icon="code" />
      <Button icon="check" />
      <Button icon="device-mobile" />
      <Button icon="alert" />
    </ButtonGroup>
  </Block>
);

const ButtonGroupExample = (): React.Element<any> => (
  <div>
    <Block>
      <ButtonGroup size="EXTRA_SMALL">
        <Button buttonType="SUCCESS">extra small</Button>
        <Button>button</Button>
        <Button>group</Button>
      </ButtonGroup>
    </Block>
    <Block>
      <ButtonGroup size="SMALL">
        <Button buttonType="SUCCESS">small</Button>
        <Button>button</Button>
        <Button>group</Button>
      </ButtonGroup>
    </Block>
    <Block>
      <ButtonGroup>
        <Button buttonType="SUCCESS">regular</Button>
        <Button>button</Button>
        <Button>group</Button>
      </ButtonGroup>
    </Block>
    <Block>
      <ButtonGroup size="LARGE">
        <Button buttonType="SUCCESS">large</Button>
        <Button>button</Button>
        <Button>group</Button>
      </ButtonGroup>
    </Block>
  </div>
);

const ButtonToolbarExample = (): React.Element<any> => (
  <div>
    <Block>
      <ButtonToolbar>
        <ButtonGroup>
          <Button>ButtonGroup</Button>
          <Button>in a</Button>
          <Button>toolbar</Button>
        </ButtonGroup>
        <Button>single buttons</Button>
        <Button>in toolbar</Button>
      </ButtonToolbar>
    </Block>
  </div>
);

export const ButtonExamples = {
  sectionName: 'Buttons',
  description: 'For clicking things.',
  examples: [
    {
      title: 'Button sizes',
      component: ButtonSizeExample,
    },
    {
      title: 'Disabled/enabled',
      component: ButtonDisabledExample,
    },
    {
      title: 'Button colors',
      component: ButtonColorExample,
    },
    {
      title: 'Buttons with icons',
      component: ButtonIconExample,
    },
    {
      title: 'Button Group',
      component: ButtonGroupExample,
    },
    {
      title: 'Button Toolbar',
      component: ButtonToolbarExample,
    },
  ],
};
