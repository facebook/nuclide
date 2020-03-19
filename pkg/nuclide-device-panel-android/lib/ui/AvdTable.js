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

import type {Expected} from 'nuclide-commons/expected';
import type {Avd} from '../providers/AvdComponentProvider';

import classnames from 'classnames';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Table} from 'nuclide-commons-ui/Table';
import * as React from 'react';

type RowData = {
  avd: Avd,
};

type Props = {
  avds: Expected<Avd[]>,
  startAvd: (avd: Avd) => void,
};

export default class AvdTable extends React.Component<Props> {
  _renderAvd = (rowProps: {data: Avd}): React.Node => {
    const {startAvd} = this.props;
    const avd = rowProps.data;

    return (
      <div
        className={classnames('nuclide-device-panel-android-emulator-row', {
          'nuclide-device-panel-android-emulator-running': avd.running,
        })}>
        {avd.name} {avd.running ? ' (running)' : ''}
        <ButtonGroup>
          <Button
            disabled={avd.running}
            icon={'triangle-right'}
            onClick={() => startAvd(avd)}
            size="SMALL"
          />
        </ButtonGroup>
      </div>
    );
  };

  _renderEmptyComponent = (): React.Node => {
    const {avds} = this.props;
    return (
      <div className="nuclide-device-panel-android-emulator-empty-message">
        {avds.isError ? avds.error.message : 'No emulators found.'}
      </div>
    );
  };

  render(): React.Node {
    const {avds} = this.props;

    const rowData: RowData[] = avds.getOrDefault([]).map(avd => {
      return {avd};
    });

    return (
      <Table
        collapsable={false}
        columns={[
          {
            title: 'Emulators',
            key: 'avd',
            component: this._renderAvd.bind(this),
          },
        ]}
        emptyComponent={this._renderEmptyComponent}
        fixedHeader={true}
        rows={rowData.map(data => {
          return {data};
        })}
      />
    );
  }
}
