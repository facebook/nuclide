'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type DebuggerModel from './DebuggerModel';
import type {
  WatchExpressionListStore,
} from './WatchExpressionListStore';
import type {
  Callstack,
  ControlButtonSpecification,
  DebuggerModeType,
  FileLineBreakpoints,
  ThreadItem,
} from './types';

import {CompositeDisposable} from 'atom';
import {
  React,
} from 'react-for-atom';
import {Section} from '../../nuclide-ui/Section';
import {bindObservableAsProps} from '../../nuclide-ui/bindObservableAsProps';
import {WatchExpressionComponent} from './WatchExpressionComponent';
import {LocalsComponent} from './LocalsComponent';
import {BreakpointListComponent} from './BreakpointListComponent';
import {DebuggerSteppingComponent} from './DebuggerSteppingComponent';
import {DebuggerCallstackComponent} from './DebuggerCallstackComponent';
import {DebuggerThreadsComponent} from './DebuggerThreadsComponent';

type Props = {
  model: DebuggerModel,
  watchExpressionListStore: WatchExpressionListStore,
};

export class NewDebuggerView extends React.Component {
  props: Props;
  state: {
    allowSingleThreadStepping: boolean,
    togglePauseOnException: boolean,
    togglePauseOnCaughtException: boolean,
    enableSingleThreadStepping: boolean,
    debuggerMode: DebuggerModeType,
    selectedCallFrameIndex: number,
    callstack: ?Callstack,
    breakpoints: ?FileLineBreakpoints,
    showThreadsWindow: boolean,
    threadList: Array<ThreadItem>,
    selectedThreadId: number,
    customControlButtons: Array<ControlButtonSpecification>,
  };
  _watchExpressionComponentWrapped: ReactClass<any>;
  _localsComponentWrapped: ReactClass<any>;
  _disposables: CompositeDisposable;

  constructor(props: Props) {
    super(props);
    this._watchExpressionComponentWrapped = bindObservableAsProps(
      props.model.getWatchExpressionListStore().getWatchExpressions().map(
        watchExpressions => ({watchExpressions}),
      ),
      WatchExpressionComponent,
    );
    this._localsComponentWrapped = bindObservableAsProps(
      props.model.getLocalsStore().getLocals().map(
        locals => ({locals}),
      ),
      LocalsComponent,
    );
    this._disposables = new CompositeDisposable();
    const debuggerStore = props.model.getStore();
    const threadStore = props.model.getThreadStore();
    this.state = {
      allowSingleThreadStepping: Boolean(debuggerStore.getSettings().get('SingleThreadStepping')),
      debuggerMode: debuggerStore.getDebuggerMode(),
      togglePauseOnException: debuggerStore.getTogglePauseOnException(),
      togglePauseOnCaughtException: debuggerStore.getTogglePauseOnCaughtException(),
      enableSingleThreadStepping: debuggerStore.getEnableSingleThreadStepping(),
      showThreadsWindow: Boolean(debuggerStore.getSettings().get('SupportThreadsWindow')),
      selectedCallFrameIndex: props.model.getCallstackStore().getSelectedCallFrameIndex(),
      callstack: props.model.getCallstackStore().getCallstack(),
      breakpoints: props.model.getBreakpointStore().getAllBreakpoints(),
      threadList: threadStore.getThreadList(),
      selectedThreadId: threadStore.getSelectedThreadId(),
      customControlButtons: debuggerStore.getCustomControlButtons(),
    };
  }

  componentDidMount(): void {
    const debuggerStore = this.props.model.getStore();
    this._disposables.add(
      debuggerStore.onChange(() => {
        this.setState({
          // We need to refetch some values that we already got in the constructor
          // since these values weren't necessarily properly intialized until now.
          allowSingleThreadStepping: Boolean(debuggerStore.getSettings()
            .get('SingleThreadStepping')),
          debuggerMode: debuggerStore.getDebuggerMode(),
          togglePauseOnException: debuggerStore.getTogglePauseOnException(),
          togglePauseOnCaughtException: debuggerStore.getTogglePauseOnCaughtException(),
          enableSingleThreadStepping: debuggerStore.getEnableSingleThreadStepping(),
          showThreadsWindow: Boolean(debuggerStore.getSettings()
            .get('SupportThreadsWindow')),
          customControlButtons: debuggerStore.getCustomControlButtons(),
        });
      }),
    );
    const callstackStore = this.props.model.getCallstackStore();
    this._disposables.add(
      callstackStore.onChange(() => {
        this.setState({
          selectedCallFrameIndex: callstackStore.getSelectedCallFrameIndex(),
          callstack: callstackStore.getCallstack(),
        });
      }),
    );
    const breakpointStore = this.props.model.getBreakpointStore();
    this._disposables.add(
      breakpointStore.onNeedUIUpdate(() => {
        this.setState({
          breakpoints: breakpointStore.getAllBreakpoints(),
        });
      }),
    );
    const threadStore = this.props.model.getThreadStore();
    this._disposables.add(
      threadStore.onChange(() => {
        this.setState({
          threadList: threadStore.getThreadList(),
          selectedThreadId: threadStore.getSelectedThreadId(),
        });
      }),
    );
  }

  componentWillUnmount(): void {
    this._dispose();
  }

  render(): React.Element<any> {
    const {
      model,
    } = this.props;
    const actions = model.getActions();
    const WatchExpressionComponentWrapped = this._watchExpressionComponentWrapped;
    const LocalsComponentWrapped = this._localsComponentWrapped;
    const threadsSection = this.state.showThreadsWindow
      ? <Section collapsable={true} headline="Threads"
                 className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <DebuggerThreadsComponent
              bridge={this.props.model.getBridge()}
              threadList={this.state.threadList}
              selectedThreadId={this.state.selectedThreadId}
            />
          </div>
        </Section>
      : null;
    return (
      <div className="nuclide-debugger-container-new">
        <Section collapsable={true} headline="Debugger Controls"
                 className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <DebuggerSteppingComponent
              actions={actions}
              debuggerMode={this.state.debuggerMode}
              pauseOnException={this.state.togglePauseOnException}
              pauseOnCaughtException={this.state.togglePauseOnCaughtException}
              allowSingleThreadStepping={this.state.allowSingleThreadStepping}
              singleThreadStepping={this.state.enableSingleThreadStepping}
              customControlButtons={this.state.customControlButtons}
            />
          </div>
        </Section>
        {threadsSection}
        <Section collapsable={true} headline="Call Stack"
                 className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <DebuggerCallstackComponent
              actions={actions}
              callstack={this.state.callstack}
              bridge={this.props.model.getBridge()}
              selectedCallFrameIndex={this.state.selectedCallFrameIndex}
            />
          </div>
        </Section>
        <Section collapsable={true} headline="Breakpoints"
                 className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <BreakpointListComponent
              actions={actions}
              breakpoints={this.state.breakpoints}
            />
          </div>
        </Section>
        <Section collapsable={true} headline="Locals"
                 className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <LocalsComponentWrapped
              watchExpressionStore={model.getWatchExpressionStore()}
            />
          </div>
        </Section>
        <Section collapsable={true} headline="Watch Expressions"
                 className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <WatchExpressionComponentWrapped
              onAddWatchExpression={actions.addWatchExpression.bind(model)}
              onRemoveWatchExpression={actions.removeWatchExpression.bind(model)}
              onUpdateWatchExpression={actions.updateWatchExpression.bind(model)}
              watchExpressionStore={model.getWatchExpressionStore()}
            />
          </div>
        </Section>
      </div>
    );
  }

  _dispose(): void {
    this._disposables.dispose();
  }
}
