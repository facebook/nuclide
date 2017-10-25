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
import {Block} from 'nuclide-commons-ui/Block';
import {Toggle} from 'nuclide-commons-ui/Toggle';

const NOOP = () => {};

const ToggleExample = (): React.Element<any> => (
  <div>
    <Block>
      <Toggle
        toggled={false}
        onClick={NOOP}
        onChange={NOOP}
        label="A Toggle."
      />
    </Block>
    <Block>
      <Toggle
        onClick={NOOP}
        onChange={NOOP}
        toggled={true}
        label="A toggled Toggle."
      />
    </Block>
    <Block>
      <Toggle
        onClick={NOOP}
        onChange={NOOP}
        disabled={true}
        toggled={false}
        label="A disabled Toggle."
      />
    </Block>
    <Block>
      <Toggle
        onClick={NOOP}
        onChange={NOOP}
        toggled={true}
        disabled={true}
        label="A disabled, toggled Toggle."
      />
    </Block>
  </div>
);

export const ToggleExamples = {
  sectionName: 'Toggle',
  description: 'Toggle input for boolean values',
  examples: [
    {
      title: 'Toggle Input Example',
      component: ToggleExample,
    },
  ],
};
