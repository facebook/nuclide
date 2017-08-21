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

import React from 'react';
import type {Callstack, CallstackItem} from './types';
import type DebuggerActions from './DebuggerActions';
import type CallstackStore from './CallstackStore';

import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import Bridge from './Bridge';
import {Table} from 'nuclide-commons-ui/Table';
import classnames from 'classnames';
import addTooltip from 'nuclide-commons-ui/addTooltip';

type DebuggerCallstackComponentProps = {
  actions: DebuggerActions,
  bridge: Bridge,
  callstackStore: CallstackStore,
};

type DebuggerCallstackComponentState = {
  callstack: ?Callstack,
  selectedCallFrameIndex: number,
};

export class DebuggerCallstackComponent extends React.Component {
  props: DebuggerCallstackComponentProps;
  state: DebuggerCallstackComponentState;
  _disposables: UniversalDisposable;

  constructor(props: DebuggerCallstackComponentProps) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      callstack: props.callstackStore.getCallstack(),
      selectedCallFrameIndex: props.callstackStore.getSelectedCallFrameIndex(),
    };
  }

  _locationComponent = (props: {
    data: {
      path: string,
      line: number,
      column?: number,
      hasSource?: boolean,
    },
  }): React.Element<any> => {
    const missingSourceItem =
      this.props.callstackStore.getDebuggerStore().getCanSetSourcePaths() &&
      !props.data.hasSource
        ? <span
            className={classnames('text-error', 'icon', 'icon-alert')}
            onClick={() => this.props.actions.configureSourcePaths()}
            ref={addTooltip({
              title:
                'Source file not found! Some debugger features will not work without source.' +
                '<br/><br/>' +
                'Click to configure source file paths...',
            })}
          />
        : null;

    // Callstack paths may have a format like file://foo/bar, or
    // lldb://asm/0x1234. These are not valid paths that can be used to
    // construct a nuclideUri so we need to skip the protocol prefix.
    const path = nuclideUri.basename(
      props.data.path.replace(/^[a-zA-Z]+:\/\//, ''),
    );

    // Chrome line numbers are actually 0-based, so add 1.
    const line = props.data.line + 1;
    return (
      <div title={`${path}:${line}`}>
        {missingSourceItem}
        <span>
          {path}:{line}
        </span>
      </div>
    );
  };

  componentDidMount(): void {
    const {callstackStore} = this.props;
    this._disposables.add(
      callstackStore.onChange(() => {
        this.setState({
          selectedCallFrameIndex: callstackStore.getSelectedCallFrameIndex(),
          callstack: callstackStore.getCallstack(),
        });
      }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _handleCallframeClick = (
    clickedCallframe: ?CallstackItem,
    callFrameIndex: number,
  ): void => {
    this.props.bridge.setSelectedCallFrameIndex(callFrameIndex);
    this.props.actions.setSelectedCallFrameIndex(callFrameIndex);
  };

  render(): ?React.Element<any> {
    const {callstack} = this.state;
    const rows =
      callstack == null
        ? []
        : callstack.map((callstackItem, i) => {
            const {location} = callstackItem;
            const isSelected = this.state.selectedCallFrameIndex === i;
            const cellData = {
              data: {
                frame: i,
                address: callstackItem.name,
                location,
                isSelected,
              },
            };

            if (isSelected) {
              // $FlowIssue className is an optional property of a table row
              cellData.className = 'nuclide-debugger-callstack-item-selected';
            }

            return cellData;
          });

    const columns = [
      {
        title: '',
        key: 'frame',
        width: 0.05,
      },
      {
        title: 'Address',
        key: 'address',
      },
      {
        component: this._locationComponent,
        title: 'File Location',
        key: 'location',
      },
    ];

    const emptyComponent = () =>
      <div className="nuclide-debugger-callstack-list-empty">
        callstack unavailable
      </div>;

    return (
      <Table
        className="nuclide-debugger-callstack-table"
        columns={columns}
        emptyComponent={emptyComponent}
        rows={rows}
        selectable={true}
        resizable={true}
        onSelect={this._handleCallframeClick}
        sortable={false}
        ref="callstackTable"
      />
    );
  }
}
