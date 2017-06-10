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
import type {
  AttachTargetInfo,
} from '../../nuclide-debugger-native-rpc/lib/NativeDebuggerServiceInterface';
import type {Column} from 'nuclide-commons-ui/Table';

import React from 'react';
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
  sortedColumn: ?string,
};

function getColumns(): Array<Column> {
  return [
    {
      title: 'Process Name',
      key: 'process',
      width: 0.25,
    },
    {
      title: 'PID',
      key: 'pid',
      width: 0.10,
    },
    {
      title: 'Command Name',
      key: 'command',
      width: 0.65,
    },
  ];
}

function getCompareFunction(
  sortedColumn: ?string,
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

export class AttachUIComponent
  extends React.Component<void, PropsType, StateType> {
  props: PropsType;
  state: StateType;
  _targetListUpdating: boolean;
  _disposables: UniversalDisposable;
  _deserializedSavedSettings: boolean;

  constructor(props: PropsType) {
    super(props);

    (this: any)._handleFilterTextChange = this._handleFilterTextChange.bind(
      this,
    );
    (this: any)._handleSelectTableRow = this._handleSelectTableRow.bind(this);
    (this: any)._handleAttachClick = this._handleAttachClick.bind(this);
    (this: any)._updateAttachTargetList = this._updateAttachTargetList.bind(
      this,
    );
    (this: any)._updateList = this._updateList.bind(this);
    (this: any)._handleSort = this._handleSort.bind(this);
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

  _updateList(): void {
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
        },
      );
    }

    if (newSelectedTarget == null) {
      newSelectedTarget = this.state.selectedAttachTarget == null
        ? null
        : this._getAttachTargetOfPid(this.state.selectedAttachTarget.pid);
    }
    this._targetListUpdating = false;
    this.setState({
      attachTargetInfos: this.props.store.getAttachTargetInfos(),
      selectedAttachTarget: newSelectedTarget,
      filterText: filterText || this.state.filterText,
    });
  }

  _getAttachTargetOfPid(pid: number): ?AttachTargetInfo {
    for (const target of this.props.store.getAttachTargetInfos()) {
      if (target.pid === pid) {
        return target;
      }
    }
    return null;
  }

  _handleSort(sortedColumn: ?string, sortDescending: boolean): void {
    this.setState({
      sortedColumn,
      sortDescending,
    });
  }

  render(): React.Element<any> {
    const filterRegex = new RegExp(this.state.filterText, 'i');
    const {attachTargetInfos, sortedColumn, sortDescending} = this.state;
    const compareFn = getCompareFunction(sortedColumn, sortDescending);
    const {selectedAttachTarget} = this.state;
    let selectedIndex = null;
    const rows = attachTargetInfos
      .filter(
        item =>
          filterRegex.test(item.name) ||
          filterRegex.test(item.pid.toString()) ||
          filterRegex.test(item.commandName),
      )
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
      </div>
    );
  }

  _handleFilterTextChange(text: string): void {
    this.setState({
      filterText: text,
    });
  }

  _handleSelectTableRow(item: {pid: number}, selectedIndex: number): void {
    const attachTarget = this._getAttachTargetOfPid(item.pid);
    this.setState({
      selectedAttachTarget: attachTarget,
    });
  }

  _handleDoubleClickTableRow(): void {
    this._attachToProcess();
  }

  _handleAttachClick(): void {
    this._attachToProcess();
  }

  _updateAttachTargetList(): void {
    // Fire and forget.
    if (!this._targetListUpdating) {
      this._targetListUpdating = true;
      this.props.actions.updateAttachTargetList();
    }
  }

  _attachToProcess(): void {
    const attachTarget = this.state.selectedAttachTarget;
    if (attachTarget != null) {
      // Fire and forget.
      this.props.actions.attachDebugger(attachTarget);
      serializeDebuggerConfig(
        ...this._getSerializationArgs(),
        {},
        {
          attachPid: attachTarget.pid,
          attachName: attachTarget.name,
          filterText: this.state.filterText,
        },
      );
    }
  }
}
