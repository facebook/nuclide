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
import {
  FlexDirections,
  ResizableFlexContainer,
  ResizableFlexItem,
} from './ResizableFlexContainer';

const ResizableFlexContainerExample = (): React.Element<any> =>
  <div>
    <div style={{display: 'flex', height: 100}}>
      <ResizableFlexContainer direction={FlexDirections.HORIZONTAL}>
        <ResizableFlexItem initialFlexScale={1}>
          HORIZONTAL Content1 (1 flex scale)
        </ResizableFlexItem>
        <ResizableFlexItem initialFlexScale={0.5}>
          HORIZONTAL Content2 (0.5 flex scale)
        </ResizableFlexItem>
      </ResizableFlexContainer>
    </div>
    <div style={{display: 'flex', height: 200}}>
      <ResizableFlexContainer
        direction={FlexDirections.VERTICAL}
        flexScales={[0.5, 1, 0.5]}>
        <ResizableFlexItem initialFlexScale={0.5}>
          VERTICAL Content1 (0.5 flex scale)
        </ResizableFlexItem>
        <ResizableFlexItem initialFlexScale={1}>
          VERTICAL Content2 (1 flex scale)
        </ResizableFlexItem>
        <ResizableFlexItem initialFlexScale={0.5}>
          VERTICAL Content3 (0.5 flex scale)
        </ResizableFlexItem>
      </ResizableFlexContainer>
    </div>
  </div>;

export const ResizableFlexContainerExamples = {
  sectionName: 'ResizableFlexContainer',
  description: 'Flex container to host resizable elements',
  examples: [
    {
      title: 'Flex Container Example',
      component: ResizableFlexContainerExample,
    },
  ],
};
