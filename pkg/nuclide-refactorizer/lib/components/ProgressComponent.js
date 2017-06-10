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

import type {ProgressPhase} from '../types';

import React from 'react';

import {ProgressBar} from 'nuclide-commons-ui/ProgressBar';

type Props = {
  phase: ProgressPhase,
};

export class ProgressComponent extends React.Component {
  props: Props;

  render(): React.Element<any> {
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
