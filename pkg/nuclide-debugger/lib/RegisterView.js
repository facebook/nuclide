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

import type {RegisterInfo} from './types';

import * as React from 'react';
import CallstackStore from './CallstackStore';
import DebuggerModel from './DebuggerModel';
import {Table} from 'nuclide-commons-ui/Table';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';

type Props = {
  model: DebuggerModel,
};

type State = {
  registerInfo: ?RegisterInfo,
  filter: string,
};

export class RegisterView extends React.Component<Props, State> {
  _state: State;
  _callstackStore: CallstackStore;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);

    (this: any)._callStackUpdated = this._callStackUpdated.bind(this);

    this._disposables = new UniversalDisposable();
    this._callstackStore = this.props.model.getCallstackStore();
    this.state = {
      registerInfo: null,
      filter: '',
    };
  }

  componentDidMount(): void {
    this._disposables.add(
      this._callstackStore.onChange(() => {
        this._callStackUpdated();
      }),
    );

    this._callStackUpdated();
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _callStackUpdated(): void {
    const callstack = this._callstackStore.getCallstack();
    if (callstack == null || callstack.length === 0) {
      this.setState({
        registerInfo: null,
      });
    } else {
      const selectedFrame = this._callstackStore.getSelectedCallFrameIndex();
      const selectedFrameInfo = callstack[selectedFrame];
      this.setState({
        registerInfo:
          selectedFrameInfo != null ? selectedFrameInfo.registers : null,
      });
    }
  }

  render(): React.Element<any> {
    const {registerInfo} = this.state;

    if (registerInfo == null) {
      return (
        <div className="nuclide-debugger-registers-empty">
          No register info available.
        </div>
      );
    }

    const columns = [
      {
        title: 'Register',
        key: 'register',
        width: 0.2,
      },
      {
        title: 'Value (hex)',
        key: 'value',
        width: 0.4,
      },
      {
        title: 'Value (decimal)',
        key: 'decimal',
        width: 0.4,
      },
    ];

    const emptyComponent = () => (
      <div className="nuclide-debugger-registers-empty">
        registers unavailable.
      </div>
    );

    const groups = registerInfo.map(group => {
      const rows = group.registers
        .filter(r => {
          const filter = this.state.filter.trim();
          if (filter === '') {
            return true;
          }

          try {
            const exp = new RegExp(filter, 'i');
            return (
              r.name.match(exp) != null ||
              r.value.match(exp) != null ||
              parseInt(r.value, 16)
                .toString()
                .match(exp) != null
            );
          } catch (e) {
            // If the user enters an invalid regular expression, fall back
            // to string contains matching.
            return r.name.includes(filter);
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(register => {
          const decimalValue = parseInt(register.value, 16);
          return {
            data: {
              register: register.name,
              value: register.value,
              decimal: Number.isNaN(decimalValue) ? '' : decimalValue,
            },
          };
        });
      if (rows.length === 0) {
        return null;
      }
      return (
        <div
          className="nuclide-debugger-registers-view"
          key={`registerGroup_${group.groupName}`}>
          <div className="nuclide-debugger-registers-group">
            {group.groupName}
          </div>
          <Table
            columns={columns}
            emptyComponent={emptyComponent}
            rows={rows}
            selectable={false}
            resizable={true}
            sortable={false}
          />
        </div>
      );
    });

    return (
      <div className="nuclide-debugger-container-new">
        <div>
          <AtomInput
            size="sm"
            placeholderText="Filter registers by regex..."
            value={this.state.filter}
            onDidChange={filter => this.setState({filter})}
          />
        </div>
        <div className="nuclide-debugger-pane-content">{groups}</div>
      </div>
    );
  }
}
