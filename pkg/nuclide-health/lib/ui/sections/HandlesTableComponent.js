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

type Props<T> = {
  title: string,
  handles: Array<T>,
  keyed: Function,
  columns: Array<{
    title: string,
    value: (handle: T, index: number) => ?string | ?number,
    widthPercentage: number,
  }>,
};

export default class HandlesTableComponent<T: Object> extends React.Component<
  Props<T>,
  void,
> {
  props: Props<T>;

  previousHandleSummaries: Object;

  constructor(props: Object) {
    super(props);
    this.previousHandleSummaries = {};
  }

  getHandleSummaries(handles: Array<T>): Object {
    const handleSummaries = {};
    handles.forEach((handle, h) => {
      const summarizedHandle = {};
      this.props.columns.forEach((column, c) => {
        summarizedHandle[c] = column.value(handle, h);
      });
      handleSummaries[this.props.keyed(handle, h)] = summarizedHandle;
    });
    return handleSummaries;
  }

  render(): React.Node {
    if (this.props.handles.length === 0) {
      return <div />;
    }

    const handleSummaries = this.getHandleSummaries(this.props.handles);
    const component = (
      <div>
        <h3>{this.props.title}</h3>
        <table className="table">
          <thead>
            <tr>
              <th width="10%">ID</th>
              {this.props.columns.map((column, c) => (
                <th key={c} width={`${column.widthPercentage}%`}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(handleSummaries).map(key => {
              const handleSummary = handleSummaries[key];
              const previousHandle = this.previousHandleSummaries[key];
              return (
                <tr
                  key={key}
                  className={previousHandle ? '' : 'nuclide-health-handle-new'}>
                  <th>{key}</th>
                  {this.props.columns.map((column, c) => {
                    let className = '';
                    if (
                      previousHandle &&
                      previousHandle[c] !== handleSummary[c]
                    ) {
                      className = 'nuclide-health-handle-updated';
                    }
                    return (
                      <td key={c} className={className}>
                        {handleSummary[c]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    this.previousHandleSummaries = handleSummaries;
    return component;
  }
}
