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

import type {Column} from 'nuclide-commons-ui/Table';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ProcessInfo} from 'nuclide-commons/process';
import * as React from 'react';

import {getVSCodeDebuggerAdapterServiceByNuclideUri} from './debug-adapter-service';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Table} from 'nuclide-commons-ui/Table';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

const PROCESS_UPDATES_INTERVAL_MS = 2000;

const COLUMNS: Array<Column<*>> = [
  {
    title: 'Process Binary',
    key: 'process',
    width: 0.25,
  },
  {
    title: 'PID',
    key: 'pid',
    width: 0.1,
  },
  {
    title: 'Command',
    key: 'command',
    width: 0.65,
  },
];

type ColumnName = 'process' | 'pid' | 'command';

type ProcessRow = {
  process: string,
  pid: number,
  command: string,
};

type Props = {|
  +targetUri: NuclideUri,
  +onSelect?: (selectedProcess: ?ProcessRow) => mixed,
|};

type State = {
  processList: Array<ProcessRow>,
  selectedProcess: ?ProcessRow,
  sortDescending: boolean,
  sortedColumn: ?ColumnName,
  filterText: string,
};

function getCompareFunction(
  sortedColumn: ?ColumnName,
  sortDescending: boolean,
): (a: ProcessRow, b: ProcessRow) => number {
  switch (sortedColumn) {
    case 'process':
      return (target1: ProcessRow, target2: ProcessRow) => {
        const first = sortDescending ? target2.process : target1.process;
        const second = sortDescending ? target1.process : target2.process;
        return first.toLowerCase().localeCompare(second.toLowerCase());
      };
    case 'pid':
      const order = sortDescending ? -1 : 1;
      return (target1: ProcessRow, target2: ProcessRow) =>
        order * (target1.pid - target2.pid);
    case 'command':
      return (target1: ProcessRow, target2: ProcessRow) => {
        const first = sortDescending ? target2.command : target1.command;
        const second = sortDescending ? target1.command : target2.command;
        return first.toLowerCase().localeCompare(second.toLowerCase());
      };
    default:
      break;
  }
  return () => 0;
}

function filterProcesses(processes: Array<ProcessRow>, filterText: string) {
  // Show all results if invalid regex
  let filterRegex;
  try {
    filterRegex = new RegExp(filterText, 'i');
  } catch (e) {
    return processes;
  }
  return processes.filter(
    item =>
      filterRegex.test(item.process) ||
      filterRegex.test(item.pid.toString()) ||
      filterRegex.test(item.command),
  );
}

export default class SelectableFilterableProcessTable extends React.Component<
  Props,
  State,
> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      processList: [],
      selectedProcess: null,
      sortDescending: false,
      sortedColumn: null,
      filterText: '',
    };
  }

  componentDidMount(): void {
    this._disposables.add(
      Observable.interval(PROCESS_UPDATES_INTERVAL_MS)
        .startWith(0)
        .flatMap(_ =>
          getVSCodeDebuggerAdapterServiceByNuclideUri(
            this.props.targetUri,
          ).getProcessTree(),
        )
        .subscribe(this._updateList),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  _updateList = (processes: Array<ProcessInfo>): void => {
    // On Linux, process names for which only a name is available
    // are denoted as [name] in the commandWithArgs field. These
    // names often do not play well with basename (in particular,
    // some of the contain literal slashes) so handle them as a special
    // case.
    const noargsRegex = /^\[(.*)\]$/;
    const commandName = (name, withArgs) => {
      const match = withArgs.match(noargsRegex);
      if (match != null) {
        return match[1];
      }
      return nuclideUri.basename(name);
    };

    const processList = processes.map(process => {
      return {
        process: commandName(process.command, process.commandWithArgs),
        pid: process.pid,
        command: process.commandWithArgs,
      };
    });

    this.setState({processList});
  };

  _handleFilterTextChange = (filterText: string): void => {
    // Check if we've filtered down to one option and select if so
    const filteredProcesses = filterProcesses(
      this.state.processList,
      filterText,
    );
    // TODO: (wbinnssmith) T30771435 this setState depends on current state
    // and should use an updater function rather than an object
    // eslint-disable-next-line react/no-access-state-in-setstate
    let selectedProcess = this.state.selectedProcess;
    if (filteredProcesses.length === 1) {
      // Check if we've filtered down to one option and select if so
      selectedProcess = filteredProcesses[0];
    } else if (
      filteredProcesses.findIndex(
        processRow =>
          selectedProcess != null && selectedProcess.pid === processRow.pid,
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

  setState(newState: Object): void {
    const onSelect =
      this.props.onSelect != null ? this.props.onSelect : _ => {};

    let changedSelectedProcess = false;
    if (newState.selectedProcess != null) {
      if (this.state.selectedProcess != null) {
        changedSelectedProcess =
          newState.selectedProcess.pid !== this.state.selectedProcess.pid;
      } else {
        changedSelectedProcess = true;
      }
    } else if (typeof newState.selectedProcess === 'undefined') {
      // this is the case that setState was not called with a selectedProcess
      changedSelectedProcess = false;
    } else {
      changedSelectedProcess = this.state.selectedProcess != null;
    }

    super.setState(newState, () => {
      changedSelectedProcess && onSelect(newState.selectedProcess);
    });
  }

  _handleSelectTableRow = (
    selectedProcess: ProcessRow,
    selectedIndex: number,
  ): void => {
    this.setState({selectedProcess});
  };

  _handleSort = (sortedColumn: ColumnName, sortDescending: boolean): void => {
    this.setState({
      sortedColumn,
      sortDescending,
    });
  };

  render(): React.Node {
    const {
      processList,
      sortedColumn,
      sortDescending,
      selectedProcess,
      filterText,
    } = this.state;
    const sortFunction = getCompareFunction(sortedColumn, sortDescending);
    let selectedIndex = null;

    const rows = filterProcesses(processList, filterText)
      .sort(sortFunction)
      .map((process, index) => {
        const row = {
          data: process,
        };

        if (selectedProcess != null && selectedProcess.pid === process.pid) {
          selectedIndex = index;
        }

        return row;
      });

    return (
      <div className="block">
        <p>Attach to a running native process</p>
        <AtomInput
          placeholderText="Search..."
          value={this.state.filterText}
          onDidChange={this._handleFilterTextChange}
          size="sm"
          autofocus={true}
        />
        <Table
          columns={COLUMNS}
          fixedHeader={true}
          maxBodyHeight="30em"
          rows={rows}
          sortable={true}
          onSort={this._handleSort}
          sortedColumn={this.state.sortedColumn}
          sortDescending={this.state.sortDescending}
          selectable={true}
          selectedIndex={selectedIndex}
          onSelect={this._handleSelectTableRow}
          collapsable={true}
        />
      </div>
    );
  }
}
