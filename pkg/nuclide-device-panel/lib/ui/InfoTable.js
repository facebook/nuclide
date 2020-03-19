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
import {Table} from 'nuclide-commons-ui/Table';

type Props = {|
  table: Map<string, string>,
  title: string,
|};

export class InfoTable extends React.Component<Props> {
  render(): React.Node {
    const rows = Array.from(this.props.table.entries()).map(([key, value]) => ({
      data: {property: key, value},
    }));
    const columns = [
      {
        key: 'property',
        title: 'Property',
        width: 0.4,
      },
      {
        key: 'value',
        title: 'Value',
        width: 0.6,
      },
    ];
    const emptyComponent = () => <div className="padded">No information</div>;

    return (
      <div>
        <Table
          collapsable={false}
          columns={columns}
          maxBodyHeight="99999px"
          emptyComponent={emptyComponent}
          rows={rows}
          headerTitle={this.props.title}
        />
      </div>
    );
  }
}
