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

import type {AdbDevice, AndroidJavaProcess} from 'nuclide-adb/lib/types';
import type {Column, Row} from 'nuclide-commons-ui/Table';
import type {Expected} from 'nuclide-commons/expected';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Subscription} from 'rxjs';

import idx from 'idx';
import {getAdbServiceByNuclideUri} from 'nuclide-adb';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import {Table} from 'nuclide-commons-ui/Table';
import {arrayEqual} from 'nuclide-commons/collection';
import {Expect} from 'nuclide-commons/expected';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {Observable} from 'rxjs';
import {AdbDeviceSelector} from './AdbDeviceSelector';

type ColumnName = 'pid' | 'user' | 'name';

type Props = {|
  +targetUri: NuclideUri,
  +onSelect: (deviceSerial: ?string, javaProcess: ?AndroidJavaProcess) => void,
  +deserialize: () => ?string,
|};

type State = {
  selectedDeviceSerial: ?string,
  javaProcesses: Expected<Array<AndroidJavaProcess>>,
  selectedProcess: ?AndroidJavaProcess,
  selectedProcessName: ?string,
  sortedColumn: ?ColumnName,
  sortDescending: boolean,
  filterText: string,
};

export class DeviceAndProcess extends React.Component<Props, State> {
  _disposables: UniversalDisposable;
  _javaProcessSubscription: ?Subscription;

  constructor(props: Props) {
    super(props);

    this._disposables = new UniversalDisposable();
    this._javaProcessSubscription = null;
    this._disposables.add(() => {
      if (this._javaProcessSubscription != null) {
        this._javaProcessSubscription.unsubscribe();
      }
    });

    let filterText = '';
    try {
      // $FlowFB
      filterText = require('./fb-isFBProcessName').FB_PROCESS_NAME_REGEX_STRING;
    } catch (e) {}

    this.state = {
      selectedDeviceSerial: null,
      javaProcesses: Expect.value([]),
      selectedProcess: null,
      selectedProcessName: null,
      sortedColumn: 'name',
      sortDescending: false,
      filterText,
    };
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  setState(partialState: Object, callback?: () => mixed): void {
    const fullState: State = {
      ...this.state,
      ...partialState,
    };
    super.setState(fullState, () => {
      this.props.onSelect(
        fullState.selectedDeviceSerial,
        fullState.selectedProcess,
      );
      callback && callback();
    });
  }

  _handleDeviceChange = (device: ?AdbDevice): void => {
    const oldDeviceSerial = this.state.selectedDeviceSerial;
    if (
      oldDeviceSerial != null &&
      device != null &&
      oldDeviceSerial === device.serial
    ) {
      // Same device selected.
      return;
    }

    if (this._javaProcessSubscription != null) {
      this._javaProcessSubscription.unsubscribe();
      this._javaProcessSubscription = null;
    }

    this.setState(
      {
        selectedDeviceSerial: device?.serial,
        javaProcesses: device == null ? Expect.value([]) : Expect.pending(),
        selectedProcess: null,
        selectedProcessName: this.props.deserialize(),
      },
      () => {
        if (device != null) {
          // If a device is selected, observe the Java processes on the device.
          const adbService = getAdbServiceByNuclideUri(this.props.targetUri);
          this._javaProcessSubscription = Observable.interval(2000)
            .startWith(0)
            .switchMap(() =>
              adbService.getJavaProcesses(device.serial).refCount(),
            )
            .distinctUntilChanged((a, b) =>
              arrayEqual(a, b, (x, y) => {
                return (
                  x.user === y.user && x.pid === y.pid && x.name === y.name
                );
              }),
            )
            .subscribe(javaProcesses => {
              this._javaProcessListChanged(Expect.value(javaProcesses));
            });
        }
      },
    );
  };

  _javaProcessListChanged(javaProcesses: Expected<Array<AndroidJavaProcess>>) {
    const selectedPid = this.state.selectedProcess?.pid;
    const selectedProcess = javaProcesses
      .getOrDefault([])
      .find(
        process =>
          this.state.selectedProcessName != null
            ? process.name === this.state.selectedProcessName
            : process.pid === selectedPid,
      );

    this.setState({
      javaProcesses,
      selectedProcess,
      selectedProcessName: selectedProcess?.name,
    });
  }

  _filterJavaProcesses(filterText: string) {
    // Show all results if invalid regex
    let filterRegex;
    try {
      filterRegex = new RegExp(filterText, 'i');
    } catch (e) {
      return this.state.javaProcesses.getOrDefault([]);
    }
    // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
    return this.state.javaProcesses
      .getOrDefault([])
      .filter(
        item =>
          filterRegex.test(item.user) ||
          filterRegex.test(item.pid) ||
          filterRegex.test(item.name),
      );
  }

  _handleFilterTextChange = (filterText: string): void => {
    // Check if we've filtered down to one option and select if so

    const filteredProcesses = this._filterJavaProcesses(filterText);
    // TODO: (goom) this setState depends on current state
    // and should use an updater function rather than an object
    // eslint-disable-next-line react/no-access-state-in-setstate
    let selectedProcess = this.state.selectedProcess;
    if (filteredProcesses.length === 1) {
      // Check if we've filtered down to one option and select if so
      selectedProcess = filteredProcesses[0];
    } else if (
      filteredProcesses.findIndex(
        processRow => selectedProcess?.pid === processRow.pid,
      ) === -1
    ) {
      // If we filter out our current selection,
      //   set our current selection to null
      selectedProcess = null;
    }

    this.setState({
      filterText,
      selectedProcess,
    });
  };

  _getColumns(): Array<Column<*>> {
    return [
      {
        key: 'pid',
        title: 'PID',
        width: 0.1,
      },
      {
        key: 'user',
        title: 'User',
        width: 0.1,
      },
      {
        key: 'name',
        title: 'Name',
        width: 0.8,
      },
    ];
  }

  _handleSort = (sortedColumn: ?ColumnName, sortDescending: boolean): void => {
    this.setState({sortedColumn, sortDescending});
  };

  _sortRows = (
    processes: Array<Row<*>>,
    sortedColumnName: ?ColumnName,
    sortDescending: boolean,
  ): Array<Row<*>> => {
    if (sortedColumnName == null) {
      return processes;
    }

    // Use a numerical comparison for the pid column, string compare for all the others.
    const compare: any =
      sortedColumnName === 'pid'
        ? (a: ?number, b: ?number, isAsc: boolean): number => {
            const cmp = (a || 0) - (b || 0);
            return isAsc ? cmp : -cmp;
          }
        : (a: ?string, b: ?string, isAsc: boolean): number => {
            const cmp = String(a)
              .toLowerCase()
              .localeCompare(String(b).toLowerCase());
            return isAsc ? cmp : -cmp;
          };

    const getter = row => row.data[sortedColumnName];
    return [...processes].sort((a, b) => {
      return compare(getter(a), getter(b), !sortDescending);
    });
  };

  _handleSelectTableRow = (
    item: ?AndroidJavaProcess,
    selectedIndex: number,
  ): void => {
    this.setState({
      selectedProcess: item,
      selectedProcessName: idx(item, _ => _.name),
    });
  };

  render(): React.Node {
    const emptyMessage: string =
      this.state.selectedDeviceSerial == null
        ? 'No device selected'
        : 'No debuggable Java processes found!';
    const emptyComponent = () => (
      <div>
        {this.state.javaProcesses.isPending ? (
          <LoadingSpinner size="EXTRA_SMALL" />
        ) : (
          emptyMessage
        )}
      </div>
    );

    const processListRows = this._sortRows(
      this._filterJavaProcesses(this.state.filterText).map(processRow => {
        const data = {
          pid: processRow.pid,
          user: processRow.user,
          name: processRow.name,
        };
        return {
          data,
        };
      }),
      this.state.sortedColumn,
      this.state.sortDescending,
    );

    const selectedRowIndex = processListRows.findIndex(
      row =>
        row.data.pid === this.state.selectedProcess?.pid &&
        row.data.name === this.state.selectedProcess?.name,
    );

    return (
      <div className="block">
        <label>Device:</label>
        <AdbDeviceSelector
          onChange={this._handleDeviceChange}
          targetUri={this.props.targetUri}
        />
        <label>Debuggable Java processes: </label>
        <AtomInput
          placeholderText="Search with regular expression..."
          value={this.state.filterText}
          onDidChange={this._handleFilterTextChange}
          size="sm"
          autofocus={true}
        />
        <Table
          collapsable={false}
          columns={this._getColumns()}
          emptyComponent={emptyComponent}
          fixedHeader={true}
          maxBodyHeight="30em"
          rows={processListRows}
          sortable={true}
          onSort={this._handleSort}
          sortedColumn={this.state.sortedColumn}
          sortDescending={this.state.sortDescending}
          selectable={true}
          selectedIndex={selectedRowIndex}
          onSelect={this._handleSelectTableRow}
        />
      </div>
    );
  }
}
