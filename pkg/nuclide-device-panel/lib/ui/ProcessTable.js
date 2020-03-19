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

import type {Process, ProcessTask} from 'nuclide-debugger-common/types';
import type {Expected} from 'nuclide-commons/expected';

import {ProcessTaskButton} from './ProcessTaskButton';
import * as React from 'react';
import {Table} from 'nuclide-commons-ui/Table';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';

type Props = {|
  toggleProcessPolling: (isActive: boolean) => void,
  processTasks: ProcessTask[],
  processes: Expected<Process[]>,
|};

type ColumnName = 'pid' | 'user' | 'name' | 'cpuUsage' | 'memUsage' | 'debug';

type State = {
  filterText: string,
  sortedColumn: ?ColumnName,
  sortDescending: boolean,
};

export class ProcessTable extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      filterText: '',
      sortedColumn: 'cpuUsage',
      sortDescending: true,
    };
  }

  componentDidMount(): void {
    this.props.toggleProcessPolling(true);
  }

  componentWillUnmount(): void {
    this.props.toggleProcessPolling(false);
  }

  _formatCpuUsage(cpu: ?number): string {
    return cpu == null ? '' : cpu.toFixed(2) + '%';
  }

  _formatMemUsage(mem: ?number): string {
    if (mem == null) {
      return '';
    } else if (mem < 1024) {
      return mem.toFixed(2) + 'K';
    } else {
      return (mem / 1024).toFixed(2) + 'M';
    }
  }

  _handleSort = (sortedColumn: ?ColumnName, sortDescending: boolean): void => {
    this.setState({sortedColumn, sortDescending});
  };

  _sortProcesses(
    processes: Process[],
    sortedColumnName: ?ColumnName,
    sortDescending: boolean,
  ): Process[] {
    if (sortedColumnName == null) {
      return processes;
    }
    // compare numerically the following fields
    const compare: any = ['cpuUsage', 'memUsage', 'pid', 'debug'].includes(
      sortedColumnName,
    )
      ? (a: ?number, b: ?number, isAsc: boolean): number => {
          const cmp =
            // flowlint-next-line sketchy-null-number:off
            (a || Number.NEGATIVE_INFINITY) - (b || Number.NEGATIVE_INFINITY);
          return isAsc ? cmp : -cmp;
        }
      : (a: string, b: string, isAsc: boolean): number => {
          const cmp = a.toLowerCase().localeCompare(b.toLowerCase());
          return isAsc ? cmp : -cmp;
        };

    return processes.sort((a, b) =>
      // $FlowFixMe: Process doesn't have a debug field.
      compare(a[sortedColumnName], b[sortedColumnName], !sortDescending),
    );
  }

  render(): React.Node {
    const filterRegex = new RegExp(this.state.filterText, 'i');

    let processComponent;
    if (this.props.processes.isError) {
      processComponent = <div>{this.props.processes.error.toString()}</div>;
    } else if (this.props.processes.isPending) {
      processComponent = (
        <LoadingSpinner size="EXTRA_SMALL" key="infoTableLoading" />
      );
    } else {
      const rows = this._sortProcesses(
        this.props.processes.value.filter(
          item =>
            filterRegex.test(item.user) ||
            filterRegex.test(`${item.pid}`) ||
            filterRegex.test(item.name),
        ),
        this.state.sortedColumn,
        this.state.sortDescending,
      ).map(item => ({
        data: {
          pid: (
            <div>
              <ProcessTaskButton
                icon="x"
                proc={item}
                taskType="KILL"
                nameIfManyTasks="Kill process"
                tasks={this.props.processTasks}
              />
              {item.pid}
            </div>
          ),
          user: item.user,
          name: item.name,
          cpuUsage: this._formatCpuUsage(item.cpuUsage),
          memUsage: this._formatMemUsage(item.memUsage),
          debug: (
            <ProcessTaskButton
              icon="nuclicon-debugger"
              className="nuclide-device-panel-debug-button"
              proc={item}
              taskType="DEBUG"
              nameIfManyTasks="Debug process"
              tasks={this.props.processTasks}
            />
          ),
        },
      }));
      const columns = [
        {
          key: 'pid',
          title: 'PID',
          width: 0.17,
        },
        {
          key: 'name',
          title: 'Name',
          width: 0.31,
        },
        {
          key: 'user',
          title: 'User',
          width: 0.13,
        },
        {
          key: 'cpuUsage',
          title: 'CPU',
          width: 0.15,
        },
        {
          key: 'memUsage',
          title: 'Mem',
          width: 0.15,
        },
        {
          key: 'debug',
          title: 'Debug',
          width: 0.08,
        },
      ];
      const emptyComponent = () => <div className="padded">No information</div>;
      processComponent = (
        <Table
          collapsable={false}
          columns={columns}
          maxBodyHeight="99999px"
          emptyComponent={emptyComponent}
          rows={rows}
          sortable={true}
          onSort={this._handleSort}
          sortedColumn={this.state.sortedColumn}
          sortDescending={this.state.sortDescending}
          className="nuclide-device-panel-process-table"
        />
      );
    }

    return (
      <div>
        <AtomInput
          placeholderText="Filter process..."
          initialValue={this.state.filterText}
          onDidChange={this._handleFilterTextChange}
          size="sm"
        />
        {processComponent}
      </div>
    );
  }

  _handleFilterTextChange = (text: string): void => {
    this.setState({
      filterText: text,
    });
  };
}
