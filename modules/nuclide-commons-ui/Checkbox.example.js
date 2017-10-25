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
import {Checkbox} from './Checkbox';

const NOOP = () => {};

const CheckboxExample = (): React.Element<any> => (
  <div>
    <Block>
      <Checkbox
        checked={false}
        onClick={NOOP}
        onChange={NOOP}
        label="A Checkbox."
      />
    </Block>
    <Block>
      <Checkbox
        onClick={NOOP}
        onChange={NOOP}
        checked={true}
        label="A checked Checkbox."
      />
    </Block>
    <Block>
      <Checkbox
        onClick={NOOP}
        onChange={NOOP}
        disabled={true}
        checked={false}
        label="A disabled Checkbox."
      />
    </Block>
    <Block>
      <Checkbox
        onClick={NOOP}
        onChange={NOOP}
        checked={true}
        disabled={true}
        label="A disabled, checked Checkbox."
      />
    </Block>
    <Block>
      <Checkbox
        onClick={NOOP}
        onChange={NOOP}
        indeterminate={true}
        checked={false}
        label="An indeterminate Checkbox."
      />
    </Block>
  </div>
);

export const CheckboxExamples = {
  sectionName: 'Checkbox',
  description: '',
  examples: [
    {
      title: '',
      component: CheckboxExample,
    },
  ],
};
