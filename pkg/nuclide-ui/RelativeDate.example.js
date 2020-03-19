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
import RelativeDate from './RelativeDate';

const RelativeDateExample = (): React.Element<any> => (
  <div>
    <Block>
      <div>
        Updated every 10 seconds (default): "<RelativeDate date={new Date()} />"
      </div>
      <div>
        Updated every 1 second: "
        <RelativeDate date={new Date()} delay={1000} />
        "
      </div>
    </Block>
  </div>
);

export const RelativeDateExamples = {
  sectionName: 'Relative Date',
  description: 'Renders and periodically updates a relative date string.',
  examples: [
    {
      title: 'Simple relative date',
      component: RelativeDateExample,
    },
  ],
};
