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
import {Highlight, HighlightColors} from './Highlight';

const HighlightExample = (): React.Element<any> => (
  <div>
    <Block>
      <Highlight>Default</Highlight>
    </Block>
    <Block>
      <Highlight color={HighlightColors.info}>Info</Highlight>
    </Block>
    <Block>
      <Highlight color={HighlightColors.success}>Success</Highlight>
    </Block>
    <Block>
      <Highlight color={HighlightColors.warning}>Warning</Highlight>
    </Block>
    <Block>
      <Highlight color={HighlightColors.error}>Error</Highlight>
    </Block>
  </div>
);

export const HighlightExamples = {
  sectionName: 'Highlight',
  description:
    'Highlights are useful for calling out inline content, such as tags.',
  examples: [
    {
      title: 'Highlights',
      component: HighlightExample,
    },
  ],
};
