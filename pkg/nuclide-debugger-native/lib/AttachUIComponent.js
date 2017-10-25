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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {LaunchAttachStore} from './LaunchAttachStore';
import type {LaunchAttachActions} from './LaunchAttachActions';
import type {AttachTargetInfo} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import type {Column} from 'nuclide-commons-ui/Table';

import * as React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Table} from 'nuclide-commons-ui/Table';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from '../../nuclide-debugger-base';

type PropsType = {
  targetUri: NuclideUri,
  store: LaunchAttachStore,
  actions: LaunchAttachActions,
  configIsValidChanged: (valid: boolean) => void,
};

type StateType = {
  attachTargetInfos: Array<AttachTargetInfo>,
  selectedAttachTarget: ?AttachTargetInfo,
  filterText: string,
  sortDescending: boolean,
  sortedColumn: ?ColumnName,
  attachSourcePath: string,
};

type ColumnName = 'process' | 'pid' | 'command';

function getColumns(): Array<Column<*>> {
  return [
    {
      title: 'Process Name',
      key: 'process',
      width: 0.25,
    },
    {
      title: 'PID',
      key: 'pid',
      width: 0.1,
    },
    {
      title: 'Command Name',
      key: 'command',
      width: 0.65,
    },
  ];
}

function getCompareFunction(
  sortedColumn: ?ColumnName,
  sortDescending: boolean,
): (a: AttachTargetInfo, b: AttachTargetInfo) => number {
  switch (sortedColumn) {
    case 'pid':
      const order = sortDescending ? -1 : 1;
      return (target1: AttachTargetInfo, target2: AttachTargetInfo) =>
        order * (target1.pid - target2.pid);
    case 'process':
      return (target1: AttachTargetInfo, target2: AttachTargetInfo) => {
        const first = sortDescending ? target2.name : target1.name;
        const second = sortDescending ? target1.name : target2.name;
        return first.toLowerCase().localeCompare(second.toLowerCase());
      };
    case 'command':
      return (target1: AttachTargetInfo, target2: AttachTargetInfo) => {
        const first = sortDescending
          ? target2.commandName
          : target1.commandName;
        const second = sortDescending
          ? target1.commandName
          : target2.commandName;
        return first.toLowerCase().localeCompare(second.toLowerCase());
      };
    default:
      break;
  }
  return () => 0;
}

function filterTargetInfos(
  attachTargetInfos: Array<AttachTargetInfo>,
  filterText: string,
) {
  // Show all results if invalid regex
  let filterRegex;
  try {
    filterRegex = new RegExp(filterText, 'i');
  } catch (e) {
    filterRegex = new RegExp('.*', 'i');
  }
  return attachTargetInfos.filter(
    item =>
      filterRegex.test(item.name) ||
      filterRegex.test(item.pid.toString()) ||
      filterRegex.test(item.commandName),
  );
}

export class AttachUIComponent extends React.Component<PropsType, StateType> {
  props: PropsType;
  state: StateType;
  _targetListUpdating: boolean;
  _disposables: UniversalDisposable;
  _deserializedSavedSettings: boolean;

  constructor(props: PropsType) {
    super(props);

    this._disposables = new UniversalDisposable();
    this._targetListUpdating = false;
    this._deserializedSavedSettings = false;
    this._disposables.add(
      this.props.store.onAttachTargetListChanged(this._updateList),
    );

    this.state = {
      attachTargetInfos: [],
      selectedAttachTarget: null,
      filterText: '',
      sortDescending: false,
      sortedColumn: null,
      attachSourcePath: '',
    };
  }

  _getSerializationArgs() {
    return [
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.getHostname(this.props.targetUri)
        : 'local',
      'attach',
      'native',
    ];
  }

  componentDidMount(): void {
    this.props.actions.updateParentUIVisibility(true);
    this.props.actions.updateAttachUIVisibility(true);
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          if (this._debugButtonShouldEnable()) {
            this._handleAttachClick();
          }
        },
      }),
    );
  }

  componentWillUnmount() {
    this.props.actions.updateParentUIVisibility(false);
    this.props.actions.updateAttachUIVisibility(false);
    this._disposables.dispose();
  }

  setState(newState: Object): void {
    super.setState(newState);
    this.props.configIsValidChanged(this._debugButtonShouldEnable());
  }

  _debugButtonShouldEnable(): boolean {
    return this.state.selectedAttachTarget != null;
  }

  _updateList = (): void => {
    let filterText = null;
    let newSelectedTarget = null;
    if (
      !this._deserializedSavedSettings &&
      this.state.attachTargetInfos.length > 0
    ) {
      // Deserialize the saved settings the first time the process list updates.
      this._deserializedSavedSettings = true;
      deserializeDebuggerConfig(
        ...this._getSerializationArgs(),
        (transientSettings, savedSettings) => {
          newSelectedTarget = this.state.attachTargetInfos.find(
            target =>
              target.pid === transientSettings.attachPid &&
              target.name === transientSettings.attachName,
          );
          filterText = transientSettings.filterText;
          this.setState({
            attachSourcePath: savedSettings.attachSourcePath || '',
          });
        },
      );
    }

    const filteredAttachTargetInfos = filterTargetInfos(
      this.state.attachTargetInfos,
      filterText || this.state.filterText,
    );

    // Select only option if filtered to one result
    if (filteredAttachTargetInfos.length === 1) {
      newSelectedTarget = filteredAttachTargetInfos[0];
    }

    if (newSelectedTarget == null) {
      newSelectedTarget =
        this.state.selectedAttachTarget == null
          ? null
          : this._getAttachTargetOfPid(this.state.selectedAttachTarget.pid);
    }
    this._targetListUpdating = false;
    this.setState({
      attachTargetInfos: this.props.store.getAttachTargetInfos(),
      selectedAttachTarget: newSelectedTarget,
      filterText: filterText || this.state.filterText,
    });
  };

  _getAttachTargetOfPid(pid: number): ?AttachTargetInfo {
    for (const target of this.props.store.getAttachTargetInfos()) {
      if (target.pid === pid) {
        return target;
      }
    }
    return null;
  }

  _handleSort = (sortedColumn: ?ColumnName, sortDescending: boolean): void => {
    this.setState({
      sortedColumn,
      sortDescending,
    });
  };

  render(): React.Node {
    const {attachTargetInfos, sortedColumn, sortDescending} = this.state;
    const compareFn = getCompareFunction(sortedColumn, sortDescending);
    const {selectedAttachTarget} = this.state;
    let selectedIndex = null;
    const rows = filterTargetInfos(attachTargetInfos, this.state.filterText)
      .sort(compareFn)
      .map((item, index) => {
        const row = {
          data: {
            process: item.name,
            pid: item.pid,
            command: item.commandName,
          },
        };
        if (
          selectedAttachTarget != null &&
          row.data.pid === selectedAttachTarget.pid
        ) {
          selectedIndex = index;
        }
        return row;
      });
    return (
      <div className="block">
        <AtomInput
          placeholderText="Search..."
          value={this.state.filterText}
          onDidChange={this._handleFilterTextChange}
          size="sm"
          autofocus={true}
        />
        <Table
          columns={getColumns()}
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
        <label>Source path: </label>
        <AtomInput
          ref="attachSourcePath"
          placeholderText="Optional base path for sources"
          value={this.state.attachSourcePath}
          onDidChange={value => this.setState({attachSourcePath: value})}
        />
      </div>
    );
  }

  _handleFilterTextChange = (text: string): void => {
    // Check if we've filtered down to one option and select if so
    let newSelectedTarget = this.state.selectedAttachTarget;
    const filteredAttachTargetInfos = filterTargetInfos(
      this.state.attachTargetInfos,
      text,
    );
    if (filteredAttachTargetInfos.length === 1) {
      newSelectedTarget = filteredAttachTargetInfos[0];
    }

    this.setState({
      filterText: text,
      selectedAttachTarget: newSelectedTarget,
    });
  };

  _handleSelectTableRow = (
    item: {pid: number},
    selectedIndex: number,
  ): void => {
    const attachTarget = this._getAttachTargetOfPid(item.pid);
    this.setState({
      selectedAttachTarget: attachTarget,
    });
  };

  _handleDoubleClickTableRow(): void {
    this._attachToProcess();
  }

  _handleAttachClick = (): void => {
    this._attachToProcess();
  };

  _updateAttachTargetList = (): void => {
    // Fire and forget.
    if (!this._targetListUpdating) {
      this._targetListUpdating = true;
      this.props.actions.updateAttachTargetList();
    }
  };

  _attachToProcess(): void {
    const attachTarget = this.state.selectedAttachTarget;
    if (attachTarget != null) {
      // Fire and forget.
      if (this.state.attachSourcePath !== '') {
        attachTarget.basepath = this.state.attachSourcePath;
      }
      this.props.actions.attachDebugger(attachTarget);
      serializeDebuggerConfig(
        ...this._getSerializationArgs(),
        {
          attachSourcePath: this.state.attachSourcePath,
        },
        {
          attachPid: attachTarget.pid,
          attachName: attachTarget.name,
          filterText: this.state.filterText,
        },
      );
    }
  }
}
