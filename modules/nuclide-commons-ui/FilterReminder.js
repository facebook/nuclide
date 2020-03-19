/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import * as React from 'react';

type Props = {|
  noun?: string,
  nounPlural?: string,
  filteredRecordCount: number,
  onReset: () => void,
|};

export default class FilterReminder extends React.Component<Props> {
  handleClick = (e: SyntheticEvent<>) => {
    e.preventDefault();
    this.props.onReset();
  };

  render(): React.Node {
    const {filteredRecordCount} = this.props;
    if (filteredRecordCount === 0) {
      return null;
    }

    const noun = this.props.noun ?? 'item';
    const nounPlural = this.props.nounPlural ?? `${noun}s`;

    return (
      <div className="nuclide-filter-reminder">
        <div className="nuclide-filter-reminder-message">
          <pre>
            {filteredRecordCount}{' '}
            {filteredRecordCount === 1 ? `${noun} is` : `${nounPlural} are`}{' '}
            hidden by filters.
          </pre>
        </div>
        <a href="#" onClick={this.handleClick}>
          <pre>Show all {nounPlural}</pre>
        </a>
      </div>
    );
  }
}
