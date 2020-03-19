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

import type {Column} from 'nuclide-commons-ui/Table';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Expected} from 'nuclide-commons/expected';

import * as React from 'react';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import {RemoteConnection} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  serializeDebuggerConfig,
  deserializeDebuggerConfig,
} from 'nuclide-debugger-common';
import {Table} from 'nuclide-commons-ui/Table';
import {Observable, Subscription} from 'rxjs';
import {
  getFileSystemServiceByNuclideUri,
  getHhvmDebuggerServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import {Expect} from 'nuclide-commons/expected';

type AttachType = 'webserver' | 'script';

type PropsType = {
  targetUri: NuclideUri,
  configIsValidChanged: (valid: boolean) => void,
  startAttachProcessConfig: (
    targetUri: NuclideUri,
    debugPort: ?number,
    serverAttach: boolean,
  ) => Promise<void>,
};

type StateType = {
  selectedPathIndex: number,
  pathMenuItems: Expected<Array<{label: string, value: number}>>,
  attachType: AttachType,
  attachPort: ?number,
  attachTargets: Expected<Array<{pid: number, command: string}>>,
};

function getColumns(): Array<Column<*>> {
  return [
    {
      title: 'PID',
      key: 'pid',
      width: 0.1,
    },
    {
      title: 'Command Name',
      key: 'command',
      width: 0.9,
    },
  ];
}

export class AttachUiComponent extends React.Component<PropsType, StateType> {
  props: PropsType;
  state: StateType;
  _disposables: UniversalDisposable;
  _attachTargetSub: ?Subscription;
  _gkSub: ?Subscription;

  constructor(props: PropsType) {
    super(props);
    this._disposables = new UniversalDisposable();
    this._attachTargetSub = null;
    this._disposables.add(() => {
      if (this._attachTargetSub != null) {
        this._attachTargetSub.unsubscribe();
        this._attachTargetSub = null;
      }

      if (this._gkSub != null) {
        this._gkSub.unsubscribe();
        this._gkSub = null;
      }
    });
    (this: any)._handleAttachButtonClick = this._handleAttachButtonClick.bind(
      this,
    );

    this.state = {
      selectedPathIndex: 0,
      pathMenuItems: Expect.pending(),
      attachPort: null,
      attachType: 'webserver',
      attachTargets: Expect.pending(),
    };
  }

  _getSerializationArgs() {
    return [
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.getHostname(this.props.targetUri)
        : 'local',
      'attach',
      'php',
    ];
  }

  componentDidMount(): void {
    this._disposables.add(
      Observable.fromPromise(this._getPathMenuItems()).subscribe(
        pathMenuItems => {
          deserializeDebuggerConfig(
            ...this._getSerializationArgs(),
            (transientSettings, savedSettings) => {
              const items = pathMenuItems.getOrDefault([]);
              const savedPath = items.find(
                item => item.label === savedSettings.selectedPath,
              );
              const savedIndex = items.indexOf(savedPath);

              this.setState({
                selectedPathIndex: savedIndex < 0 ? 0 : savedIndex,
                attachType:
                  savedSettings.attachType != null
                    ? savedSettings.attachType
                    : 'webserver',
              });
            },
          );
        },
      ),
    );

    this.props.configIsValidChanged(this._debugButtonShouldEnable());
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          if (this._debugButtonShouldEnable()) {
            this._handleAttachButtonClick();
          }
        },
      }),
    );

    this._attachTargetSub = Observable.interval(2000)
      .switchMap(async () => {
        await this._refreshTargetList();
      })
      .subscribe();
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  setState(newState: Object): void {
    super.setState(newState, () =>
      this.props.configIsValidChanged(this._debugButtonShouldEnable()),
    );
  }

  _debugButtonShouldEnable(): boolean {
    const selectedPath =
      !this.state.pathMenuItems.isPending && !this.state.pathMenuItems.isError
        ? this.state.pathMenuItems.value[this.state.selectedPathIndex]
        : null;

    return (
      (this.state.attachType === 'webserver' && selectedPath != null) ||
      this.state.attachPort != null
    );
  }

  async _refreshTargetList(): Promise<void> {
    const service = await getHhvmDebuggerServiceByNuclideUri(
      this.props.targetUri,
    );
    if (service != null) {
      const attachTargets = await service.getAttachTargetList();
      this.setState({attachTargets: Expect.value(attachTargets)});
    }
  }

  render(): React.Node {
    const emptyComponent = this.state.attachTargets.isPending
      ? () => <div className="debugger-php-attach-list-empty">Loading...</div>
      : () => (
          <div className="debugger-php-attach-list-empty">
            To enable attaching this debugger, pass the arguments:<br />
            <b>--mode vsdebug --vsDebugPort &lt;port&gt;</b>
            <br />
            and optionally <b>--vsDebugNoWait</b> to HHVM when launching your
            script. The script should then show in this list.
          </div>
        );

    const rows = this.state.attachTargets.getOrDefault([]).map(target => ({
      data: {
        pid: target.pid,
        command: target.command,
      },
    }));

    let selectedIndex = -1;
    if (this.state.attachPort != null) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (
          this.state.attachPort === this._getPortFromHHVMArgs(row.data.command)
        ) {
          selectedIndex = i;
          break;
        }
      }
    }

    const pathMenuItems: Array<{label: string, value: number}> =
      this.state.pathMenuItems.isPending || this.state.pathMenuItems.isError
        ? []
        : this.state.pathMenuItems.value;
    return (
      <div className="block">
        <div className="nuclide-ui-radiogroup-div">
          <input
            className="input-radio"
            type="radio"
            checked={this.state.attachType === 'webserver'}
            name="radiogroup-attachtype"
            onChange={() =>
              this.setState({attachType: 'webserver', attachPort: null})
            }
          />
          <label className="input-label nuclide-ui-radiogroup-label">
            <b>Attach to webserver</b>
          </label>
          <div className="debugger-php-launch-attach-ui-select-project">
            <label>Selected Project Directory: </label>
            {pathMenuItems.length > 0 ? (
              <Dropdown
                className="inline-block debugger-connection-box"
                options={pathMenuItems.map(item => ({
                  ...item,
                  disabled: false,
                }))}
                onChange={this._handlePathsDropdownChange}
                value={this.state.selectedPathIndex}
                disabled={this.state.attachType !== 'webserver'}
              />
            ) : (
              <div>
                {this.state.pathMenuItems.isPending
                  ? 'Loading project roots...'
                  : 'No Hack roots found! Try adding a directory that contains your .hhconfig file to the file tree!'}
              </div>
            )}
          </div>
          <div>
            <input
              className="input-radio"
              type="radio"
              checked={this.state.attachType === 'script'}
              name="radiogroup-attachtype"
              onChange={() =>
                this.setState({
                  attachType: 'script',
                  attachPort:
                    selectedIndex >= 0 && selectedIndex < rows.length
                      ? this._getPortFromHHVMArgs(
                          rows[selectedIndex].data.command,
                        )
                      : null,
                })
              }
            />
            <label className="input-label nuclide-ui-radiogroup-label">
              <b>Attach to an already-running PHP/Hack script</b>
            </label>
            <div className="debugger-php-launch-attach-ui-select-script">
              {this.state.attachType === 'script' ? (
                <Table
                  emptyComponent={emptyComponent}
                  columns={getColumns()}
                  fixedHeader={true}
                  maxBodyHeight="30em"
                  rows={rows}
                  sortable={false}
                  selectable={true}
                  selectedIndex={selectedIndex}
                  onSelect={(item: {command: string}) => {
                    this.setState({
                      attachPort: this._getPortFromHHVMArgs(item.command),
                    });
                  }}
                  collapsable={true}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  _getPortFromHHVMArgs(command: string): ?number {
    const pattern = /--vsDebugPort(=|\s+)([0-9]+)/gi;
    const match = pattern.exec(command);
    return match != null && match.length >= 3 ? parseInt(match[2], 10) : null;
  }

  async _getPathMenuItems(): Promise<
    Expected<Array<{label: string, value: number}>>,
  > {
    const connections = RemoteConnection.getByHostname(
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.getHostname(this.props.targetUri)
        : 'local',
    );

    const pathMenuItems: Array<{|label: string, value: number|}> = [];

    if (nuclideUri.isRemote(this.props.targetUri)) {
      // $FlowIgnore filter ensures not null
      pathMenuItems.push(
        ...(await Promise.all(
          connections.map(async (connection, index) => {
            const pathToProject = connection.getPath();
            const fsSvc = getFileSystemServiceByNuclideUri(connection.getUri());
            if (
              (await fsSvc.findNearestAncestorNamed(
                '.hhconfig',
                pathToProject,
              )) != null
            ) {
              return {
                label: pathToProject,
                value: index,
              };
            }
            return null;
          }),
        )).filter(p => p != null),
      );
    } else {
      const fsSvc = getFileSystemServiceByNuclideUri(this.props.targetUri);
      await Promise.all(
        atom.project
          .getPaths()
          .filter(p => nuclideUri.isLocal(p))
          .map(async path => {
            if (
              (await fsSvc.findNearestAncestorNamed('.hhconfig', path)) != null
            ) {
              pathMenuItems.push({
                label: path,
                value: pathMenuItems.length,
              });
            }
          }),
      );
    }

    // Flow missing that pathMenuItems[i] is never null due to the filter above.
    const val = Expect.value([...pathMenuItems]);
    this.setState({
      pathMenuItems: val,
    });
    return val;
  }

  _handlePathsDropdownChange = (newIndex: number): void => {
    this.setState({
      selectedPathIndex: newIndex,
    });
  };

  async _handleAttachButtonClick(): Promise<void> {
    // Start a debug session with the user-supplied information.
    const {hostname} = nuclideUri.isRemote(this.props.targetUri)
      ? nuclideUri.parseRemoteUri(this.props.targetUri)
      : {hostname: ''};
    const selectedPath =
      this.state.attachType === 'webserver' &&
      !this.state.pathMenuItems.isPending &&
      !this.state.pathMenuItems.isError
        ? this.state.pathMenuItems.value[this.state.selectedPathIndex].label
        : '/';

    await this.props.startAttachProcessConfig(
      nuclideUri.isRemote(this.props.targetUri)
        ? nuclideUri.createRemoteUri(hostname, selectedPath)
        : 'local',
      this.state.attachPort,
      this.state.attachType === 'webserver',
    );

    serializeDebuggerConfig(...this._getSerializationArgs(), {
      selectedPath,
      attachType: this.state.attachType,
    });
  }
}
