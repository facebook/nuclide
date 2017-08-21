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

import {loggedCalls} from 'nuclide-commons/process';

import React from 'react';

export default class CommandsSectionComponent extends React.Component {
  _lastRenderCount: number;

  shouldComponentUpdate() {
    return this._lastRenderCount !== loggedCalls.length;
  }

  render() {
    this._lastRenderCount = loggedCalls.length;
    return (
      <table className="table">
        <thead>
          <th width="10%">Time</th>
          <th width="10%">Duration (ms)</th>
          <th>Command</th>
        </thead>
        <tbody>
          {loggedCalls.map((call, i) =>
            <tr key={i}>
              <td>
                {call.time.toTimeString().replace(/ .+/, '')}
              </td>
              <td>
                {call.duration}
              </td>
              <td>
                {call.command}
              </td>
            </tr>,
          )}
        </tbody>
      </table>
    );
  }
}
