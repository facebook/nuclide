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
import {Table} from './Table';

const Highlight42Component = (props: {data: ?number}): ?React.Element<any> =>
  <div style={props.data === 42 ? {fontWeight: 'bold'} : {}}>
    {props.data}
  </div>;

const TableExample = (): React.Element<any> => {
  const columns = [
    {
      title: 'first column',
      key: 'first',
    },
    {
      title: 'second column',
      key: 'second',
      component: Highlight42Component,
    },
    {
      title: 'third column',
      key: 'third',
    },
    {
      title: 'fourth column',
      key: 'fourth',
    },
    {
      title: 'fifth column',
      key: 'fifth',
    },
  ];
  const rows = [
    {
      data: {
        first: 1,
        second: 2,
        third: 3,
        fourth: 33,
        fifth: 123,
      },
    },
    {
      className: 'this-is-an-optional-classname',
      data: {
        first: 4,
        second: 42,
        third: 6,
        fourth: 66,
        fifth: 123,
      },
    },
    {
      data: {
        first: 7,
        second: 42,
        third: undefined,
        fourth: 66,
        fifth: 123,
      },
    },
  ];
  return (
    <Block>
      <Table columns={columns} rows={rows} selectable={true} />
    </Block>
  );
};

class SortableTableExample extends React.Component<
  mixed,
  {
    rows: Array<Object>,
    sortDescending: boolean,
    sortedColumn: ?string,
  },
> {
  constructor(props: mixed) {
    super(props);
    const rows = [
      {
        data: {
          first: 1,
          second: 3,
          third: 300,
        },
      },
      {
        data: {
          first: 2,
          second: 5,
          third: 200,
        },
      },
      {
        className: 'nuclide-ui-custom-classname-example',
        data: {
          first: 3,
          second: 4,
          third: 100,
        },
      },
    ];
    this.state = {
      sortDescending: false,
      sortedColumn: null,
      rows,
    };
    (this: any)._handleSort = this._handleSort.bind(this);
  }

  _handleSort(sortedColumn: ?string, sortDescending: boolean): void {
    const sortedRows = this.state.rows.sort((obj1, obj2) => {
      const order = sortDescending ? -1 : 1;
      return order * (obj1.data[sortedColumn] - obj2.data[sortedColumn]);
    });
    this.setState({
      rows: sortedRows,
      sortedColumn,
      sortDescending,
    });
  }

  render(): React.Node {
    const columns = [
      {
        title: 'first',
        key: 'first',
      },
      {
        title: 'second',
        key: 'second',
      },
      {
        title: 'third',
        key: 'third',
      },
    ];
    return (
      <Block>
        <Table
          emptyComponent={() =>
            <div>An optional, custom "empty message" component.</div>}
          columns={columns}
          rows={this.state.rows}
          sortable={true}
          onSort={this._handleSort}
          sortedColumn={this.state.sortedColumn}
          sortDescending={this.state.sortDescending}
        />
      </Block>
    );
  }
}

const EmptyTableExample = (): React.Element<any> => {
  const columns = [
    {
      title: 'first column',
      key: 'first',
    },
    {
      title: 'second column',
      key: 'second',
    },
    {
      title: 'third column',
      key: 'third',
    },
  ];
  const rows = [];
  return (
    <Block>
      <Table columns={columns} rows={rows} />
    </Block>
  );
};

export const TableExamples = {
  sectionName: 'Table',
  description: '',
  examples: [
    {
      title: 'Simple Table',
      component: TableExample,
    },
    {
      title: 'Sortable Table',
      component: SortableTableExample,
    },
    {
      title: 'Empty Table',
      component: EmptyTableExample,
    },
  ],
};
