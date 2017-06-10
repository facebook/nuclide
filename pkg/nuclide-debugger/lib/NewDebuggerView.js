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

import classnames from 'classnames';
import type DebuggerModel from './DebuggerModel';
import type {WatchExpressionListStore} from './WatchExpressionListStore';

import {CompositeDisposable} from 'atom';
import React from 'react';
import {Section} from '../../nuclide-ui/Section';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {
  FlexDirections,
  ResizableFlexContainer,
  ResizableFlexItem,
} from '../../nuclide-ui/ResizableFlexContainer';
import {WatchExpressionComponent} from './WatchExpressionComponent';
import {ScopesComponent} from './ScopesComponent';
import {BreakpointListComponent} from './BreakpointListComponent';
import {DebuggerSteppingComponent} from './DebuggerSteppingComponent';
import {DebuggerCallstackComponent} from './DebuggerCallstackComponent';
import {DebuggerThreadsComponent} from './DebuggerThreadsComponent';
import type {ThreadColumn} from '../../nuclide-debugger-base/lib/types';
import type {DebuggerModeType} from './types';
import {DebuggerMode} from './DebuggerStore';
import TruncatedButton from 'nuclide-commons-ui/TruncatedButton';

type Props = {
  model: DebuggerModel,
  watchExpressionListStore: WatchExpressionListStore,
};

export class NewDebuggerView extends React.PureComponent {
  props: Props;
  state: {
    showThreadsWindow: boolean,
    customThreadColumns: Array<ThreadColumn>,
    mode: DebuggerModeType,
    threadsComponentTitle: string,
  };
  _watchExpressionComponentWrapped: ReactClass<any>;
  _scopesComponentWrapped: ReactClass<any>;
  _disposables: CompositeDisposable;

  constructor(props: Props) {
    super(props);
    this._watchExpressionComponentWrapped = bindObservableAsProps(
      props.model
        .getWatchExpressionListStore()
        .getWatchExpressions()
        .map(watchExpressions => ({watchExpressions})),
      WatchExpressionComponent,
    );
    this._scopesComponentWrapped = bindObservableAsProps(
      props.model.getScopesStore().getScopes().map(scopes => ({scopes})),
      ScopesComponent,
    );
    this._disposables = new CompositeDisposable();
    const debuggerStore = props.model.getStore();
    this.state = {
      showThreadsWindow: Boolean(
        debuggerStore.getSettings().get('SupportThreadsWindow'),
      ),
      customThreadColumns: (debuggerStore
        .getSettings()
        .get('CustomThreadColumns'): any) || [],
      mode: debuggerStore.getDebuggerMode(),
      threadsComponentTitle: String(
        debuggerStore.getSettings().get('threadsComponentTitle'),
      ),
    };
  }

  componentDidMount(): void {
    const debuggerStore = this.props.model.getStore();
    this._disposables.add(
      debuggerStore.onChange(() => {
        this.setState({
          showThreadsWindow: Boolean(
            debuggerStore.getSettings().get('SupportThreadsWindow'),
          ),
          customThreadColumns: (debuggerStore
            .getSettings()
            .get('CustomThreadColumns'): any) || [],
          mode: debuggerStore.getDebuggerMode(),
          threadsComponentTitle: String(
            debuggerStore.getSettings().get('threadsComponentTitle'),
          ),
        });
      }),
    );
  }

  componentWillUnmount(): void {
    this._dispose();
  }

  render(): React.Element<any> {
    const {model} = this.props;
    const actions = model.getActions();
    const {mode, threadsComponentTitle, customThreadColumns} = this.state;
    const WatchExpressionComponentWrapped = this
      ._watchExpressionComponentWrapped;
    const ScopesComponentWrapped = this._scopesComponentWrapped;
    const disabledClass = mode !== DebuggerMode.RUNNING
      ? ''
      : ' nuclide-debugger-container-new-disabled';

    let threadsSection = null;
    if (this.state.showThreadsWindow) {
      threadsSection = (
        <ResizableFlexItem initialFlexScale={1}>
          <Section
            headline={threadsComponentTitle}
            className={classnames(
              'nuclide-debugger-section-header',
              disabledClass,
            )}>
            <div className="nuclide-debugger-section-content">
              <DebuggerThreadsComponent
                bridge={this.props.model.getBridge()}
                threadStore={model.getThreadStore()}
                customThreadColumns={customThreadColumns}
                threadName={threadsComponentTitle}
              />
            </div>
          </Section>
        </ResizableFlexItem>
      );
    }

    const breakpointItem = (
      <ResizableFlexItem initialFlexScale={1}>
        <Section
          headline="Breakpoints"
          key="breakpoints"
          className="nuclide-debugger-section-header">
          <div className="nuclide-debugger-section-content">
            <BreakpointListComponent
              actions={actions}
              breakpointStore={model.getBreakpointStore()}
            />
          </div>
        </Section>
      </ResizableFlexItem>
    );

    const debuggerStoppedNotice = mode !== DebuggerMode.STOPPED
      ? null
      : <ResizableFlexContainer direction={FlexDirections.VERTICAL}>
          <ResizableFlexItem initialFlexScale={1}>
            <div className="nuclide-debugger-state-notice">
              <span>The debugger is not attached.</span>
              <div className="padded">
                <TruncatedButton
                  onClick={() =>
                    atom.commands.dispatch(
                      atom.views.getView(atom.workspace),
                      'nuclide-debugger:show-attach-dialog',
                    )}
                  icon="nuclicon-debugger"
                  label="Attach debugger..."
                />
                <TruncatedButton
                  onClick={() =>
                    atom.commands.dispatch(
                      atom.views.getView(atom.workspace),
                      'nuclide-debugger:show-launch-dialog',
                    )}
                  icon="nuclicon-debugger"
                  label="Launch debugger..."
                />
              </div>
            </div>
          </ResizableFlexItem>
          {breakpointItem}
        </ResizableFlexContainer>;

    const debugeeRunningNotice = mode !== DebuggerMode.RUNNING
      ? null
      : <div className="nuclide-debugger-state-notice">
          The debug target is currently running.
        </div>;

    const debugFlexContainer = (
      <ResizableFlexContainer direction={FlexDirections.VERTICAL}>
        {threadsSection}
        <ResizableFlexItem initialFlexScale={1}>
          <Section
            headline="Call Stack"
            key="callStack"
            className={classnames(
              'nuclide-debugger-section-header',
              disabledClass,
            )}>
            <div className="nuclide-debugger-section-content">
              <DebuggerCallstackComponent
                actions={actions}
                bridge={model.getBridge()}
                callstackStore={model.getCallstackStore()}
              />
            </div>
          </Section>
        </ResizableFlexItem>
        {breakpointItem}
        <ResizableFlexItem initialFlexScale={1}>
          <Section
            headline="Scopes"
            key="scopes"
            className={classnames(
              'nuclide-debugger-section-header',
              disabledClass,
            )}>
            <div className="nuclide-debugger-section-content">
              <ScopesComponentWrapped
                watchExpressionStore={model.getWatchExpressionStore()}
              />
            </div>
          </Section>
        </ResizableFlexItem>
        <ResizableFlexItem initialFlexScale={1}>
          <Section
            headline="Watch Expressions"
            key="watchExpressions"
            className="nuclide-debugger-section-header">
            <div className="nuclide-debugger-section-content">
              <WatchExpressionComponentWrapped
                onAddWatchExpression={actions.addWatchExpression.bind(model)}
                onRemoveWatchExpression={actions.removeWatchExpression.bind(
                  model,
                )}
                onUpdateWatchExpression={actions.updateWatchExpression.bind(
                  model,
                )}
                watchExpressionStore={model.getWatchExpressionStore()}
              />
            </div>
          </Section>
        </ResizableFlexItem>
      </ResizableFlexContainer>
    );

    const debuggerContents = debuggerStoppedNotice || debugFlexContainer;
    return (
      <div className="nuclide-debugger-container-new">
        <div className="nuclide-debugger-section-header nuclide-debugger-controls-section">
          <div className="nuclide-debugger-section-content">
            <DebuggerSteppingComponent
              actions={actions}
              debuggerStore={model.getStore()}
            />
          </div>
        </div>
        {debugeeRunningNotice}
        {debuggerContents}
      </div>
    );
  }

  _dispose(): void {
    this._disposables.dispose();
  }
}
