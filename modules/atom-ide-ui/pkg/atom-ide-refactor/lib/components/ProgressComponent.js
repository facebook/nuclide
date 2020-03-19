/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {ProgressPhase} from '../types';

import * as React from 'react';

import {ProgressBar} from 'nuclide-commons-ui/ProgressBar';

type Props = {
  phase: ProgressPhase,
};

export class ProgressComponent extends React.Component<Props> {
  render(): React.Node {
    const {message, value, max} = this.props.phase;
    return (
      <div>
        {message} ({value} / {max})
        <div className="nuclide-refactorizer-progress">
          <ProgressBar value={value} max={max} />
        </div>
      </div>
    );
  }
}
