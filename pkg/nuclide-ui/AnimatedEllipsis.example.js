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

import React from 'react';
import {Block} from 'nuclide-commons-ui/Block';
import AnimatedEllipsis from './AnimatedEllipsis';

const BasicExample = (): React.Element<any> =>
  <div>
    <Block>
      Still waiting<AnimatedEllipsis />
    </Block>
  </div>;

export const AnimatedEllipsisExamples = {
  sectionName: 'AnimatedEllipsis',
  description:
    'AnimatedEllipsis is an ellipsis (...) that animated automatically while preserving constant width.',
  examples: [
    {
      title: 'Example',
      component: BasicExample,
    },
  ],
};
