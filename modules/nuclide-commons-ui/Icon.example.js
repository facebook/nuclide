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
import {Icon} from './Icon';

const IconExample = (): React.Element<any> => (
  <div>
    <Block>
      <Icon icon="gift" />
      <Icon icon="heart" />
      <Icon icon="info" />
    </Block>
  </div>
);

const IconWithTextExample = (): React.Element<any> => (
  <div>
    <Block>
      <div>
        <Icon icon="gift">gift</Icon>
      </div>
      <div>
        <Icon icon="heart">heart</Icon>
      </div>
      <div>
        <Icon icon="info">info</Icon>
      </div>
    </Block>
  </div>
);

export const IconExamples = {
  sectionName: 'Icons',
  description: 'Octicons with optional text.',
  examples: [
    {
      title: 'Icons',
      component: IconExample,
    },
    {
      title: 'You can pass optional text as children.',
      component: IconWithTextExample,
    },
  ],
};
