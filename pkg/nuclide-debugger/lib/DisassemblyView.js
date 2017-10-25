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

import type {FrameDissassembly} from './types';

import * as React from 'react';
import CallstackStore from './CallstackStore';
import DebuggerModel from './DebuggerModel';
import {Table} from 'nuclide-commons-ui/Table';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {
  model: DebuggerModel,
};

type State = {
  frameInfo: ?FrameDissassembly,
};

export class DisassemblyView extends React.Component<Props, State> {
  _state: State;
  _callstackStore: CallstackStore;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);

    (this: any)._callStackUpdated = this._callStackUpdated.bind(this);

    this._disposables = new UniversalDisposable();
    this._callstackStore = this.props.model.getCallstackStore();
    this.state = {
      frameInfo: null,
    };
  }

  componentDidMount(): void {
    this.props.model.getStore().setShowDisassembly(true);
    this._disposables.add(
      () => {
        this.props.model.getStore().setShowDisassembly(false);
      },
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
        frameInfo: null,
      });
    } else {
      const selectedFrame = this._callstackStore.getSelectedCallFrameIndex();
      const selectedFrameInfo = callstack[selectedFrame];
      this.setState({
        frameInfo:
          selectedFrameInfo != null ? selectedFrameInfo.disassembly : null,
      });
    }
  }

  render(): React.Element<any> {
    let frameMetadata = [];
    let rows = [];
    let title = null;
    let selectedIndex = 0;

    const {frameInfo} = this.state;
    if (frameInfo != null) {
      selectedIndex = frameInfo.currentInstructionIndex;
      title = frameInfo.frameTitle;
      frameMetadata = frameInfo.metadata
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(metadata => {
          return (
            <div key={`metadata_${metadata.name}`}>
              <b>{metadata.name}:</b> {metadata.value}
            </div>
          );
        });

      rows = frameInfo.instructions.map(instruction => {
        return {
          data: {
            address: instruction.address,
            instruction: instruction.instruction,
            offset: instruction.offset || '',
            comment: instruction.comment || '',
          },
        };
      });
    }
    const showOffset = rows.find(r => r.data.offset !== '') != null;
    const columns = showOffset
      ? [
          {
            title: 'Address',
            key: 'address',
            width: 0.15,
          },
          {
            title: 'Offset',
            key: 'offset',
            width: 0.15,
          },
          {
            title: 'Instruction',
            key: 'instruction',
            width: 0.35,
          },
          {
            title: 'Comment',
            key: 'comment',
            width: 0.3,
          },
        ]
      : [
          {
            title: 'Address',
            key: 'address',
            width: 0.15,
          },
          {
            title: 'Instruction',
            key: 'instruction',
            width: 0.4,
          },
          {
            title: 'Comment',
            key: 'comment',
            width: 0.4,
          },
        ];

    const emptyComponent = () => (
      <div className="nuclide-debugger-disassembly-empty">
        disassembly unavailable.
      </div>
    );

    return (
      <div className="nuclide-debugger-container-new">
        <div className="nuclide-debugger-pane-content">
          <h3>{title}</h3>
          <div>{frameMetadata}</div>
          <div className="nuclide-debugger-disassembly-helptext">
            The instructions for the current frame are displayed below. Right
            click a row to add a breakpoint at an address.
          </div>
          <div className="nuclide-debugger-disassembly-view">
            <Table
              columns={columns}
              emptyComponent={emptyComponent}
              rows={rows}
              selectable={true}
              selectedIndex={selectedIndex}
              onWillSelect={() => false}
              resizable={true}
              sortable={false}
              className="nuclide-debugger-disassembly-table"
            />
          </div>
        </div>
      </div>
    );
  }
}
