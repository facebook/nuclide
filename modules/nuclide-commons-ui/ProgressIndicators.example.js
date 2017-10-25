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
import {ProgressBar} from './ProgressBar';
import {LoadingSpinner} from './LoadingSpinner';

const ProgressBarExample = (): React.Element<any> => (
  <div>
    <Block>
      <ProgressBar />
    </Block>
    <Block>
      <ProgressBar max={100} value={0} />
    </Block>
    <Block>
      <ProgressBar max={100} value={50} />
    </Block>
    <Block>
      <ProgressBar max={100} value={100} />
    </Block>
  </div>
);

const LoadingSpinnerExample = (): React.Element<any> => (
  <div>
    <Block>
      <LoadingSpinner size="EXTRA_SMALL" />
    </Block>
    <Block>
      <LoadingSpinner size="SMALL" />
    </Block>
    <Block>
      <LoadingSpinner size="MEDIUM" />
    </Block>
    <Block>
      <LoadingSpinner size="LARGE" />
    </Block>
  </div>
);

export const ProgressIndicatorExamples = {
  sectionName: 'Progress Indicators',
  description:
    'Show that work is being performed. Consider using one of these for any work > 1s.',
  examples: [
    {
      title: 'ProgressBar',
      component: ProgressBarExample,
    },
    {
      title: 'LoadingSpinner',
      component: LoadingSpinnerExample,
    },
  ],
};
