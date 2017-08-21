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

import type {ThreadData} from '../../lib/types';

import NuclideBridge from './NuclideBridge';
import React from 'react';
import ReactDOM from 'react-dom';
import WebInspector from '../../lib/WebInspector';
import {scrollIntoView} from 'nuclide-commons-ui/scrollIntoView';

type StateType = {
  threadData: ?ThreadData,
};

class ThreadsWindowComponent extends React.Component<void, mixed, StateType> {
  props: mixed;
  state: StateType;
  _stoppedThread: ?Element;

  constructor(props: mixed) {
    super(props);
    this._registerUpdate();
    this.state = {
      threadData: null,
    };
    this._stoppedThread = null;
  }

  componentWillUnmount() {
    this._unregisterUpdate();
  }

  componentDidUpdate() {
    // We can currently scroll to the stopped thread after each render
    // because we are only rendering when we update the threads. If we
    // add more UI functionality and state changes then we may need to add
    // flags so that we are only scrolling at the correct times.
    this._scrollToStoppedThread();
  }

  _handleThreadsUpdated = (event: WebInspector.Event): void => {
    this.setState(this._getState());
  };

  _getState(): StateType {
    let threadData = null;
    const mainTarget = WebInspector.targetManager.mainTarget();
    if (mainTarget != null) {
      threadData = mainTarget.debuggerModel.threadStore.getData();
    }
    return {threadData};
  }

  _registerUpdate(): void {
    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ThreadsUpdated,
      this._handleThreadsUpdated,
      this,
    );
    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.SelectedThreadChanged,
      this._handleThreadsUpdated,
      this,
    );
    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ClearInterface,
      this._handleClearInterface,
      this,
    );
  }

  _handleClearInterface = (event: WebInspector.Event): void => {
    this.setState({threadData: null});
  };

  _unregisterUpdate(): void {
    WebInspector.targetManager.removeModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ThreadsUpdated,
      this._handleThreadsUpdated,
      this,
    );
    WebInspector.targetManager.removeModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.SelectedThreadChanged,
      this._handleThreadsUpdated,
      this,
    );
    WebInspector.targetManager.removeModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ClearInterface,
      this._handleClearInterface,
      this,
    );
  }

  _handleDoubleClick(thread: Object): void {
    NuclideBridge.selectThread(thread.id);
  }

  /**
   * '>' means the stopped thread.
   * '*' means the current selected thread.
   * Empty space for other threads.
   */
  _getIndicator(
    thread: Object,
    stopThreadId: number,
    selectedThreadId: number,
  ): string {
    return thread.id === stopThreadId
      ? '>'
      : thread.id === selectedThreadId ? '*' : ' ';
  }

  _setStoppedThread(ref: Element) {
    this._stoppedThread = ref;
  }

  _scrollToStoppedThread() {
    if (this._stoppedThread != null) {
      scrollIntoView(this._stoppedThread);
    }
  }

  render() {
    const children = [];
    const {threadData} = this.state;
    if (threadData && threadData.threadMap) {
      for (const thread of threadData.threadMap.values()) {
        const indicator = this._getIndicator(
          thread,
          threadData.stopThreadId,
          threadData.selectedThreadId,
        );
        const rowStyle = {};
        if (thread.id === threadData.selectedThreadId) {
          rowStyle.backgroundColor = '#cfcfcf';
        }
        if (indicator === '>') {
          children.push(
            <tr
              onDoubleClick={this._handleDoubleClick.bind(this, thread)}
              style={rowStyle}
              ref={ref => this._setStoppedThread(ref)}>
              <td>
                {indicator}
              </td>
              <td>
                {thread.id}
              </td>
              <td>
                {thread.address}
              </td>
              <td>
                {thread.stopReason}
              </td>
            </tr>,
          );
        } else {
          children.push(
            <tr
              onDoubleClick={this._handleDoubleClick.bind(this, thread)}
              style={rowStyle}>
              <td>
                {indicator}
              </td>
              <td>
                {thread.id}
              </td>
              <td>
                {thread.address}
              </td>
              <td>
                {thread.stopReason}
              </td>
            </tr>,
          );
        }
      }
    }

    const containerStyle = {
      maxHeight: '20em',
      overflow: 'auto',
    };

    if (children.length > 0) {
      return (
        <div
          style={containerStyle}
          className="nuclide-chrome-debugger-data-grid">
          <table width="100%">
            <thead>
              <tr key={0}>
                <td />
                <td>ID</td>
                <td>Address</td>
                <td>Stop Reason</td>
              </tr>
            </thead>
            <tbody>
              {children}
            </tbody>
          </table>
        </div>
      );
    } else {
      return <div className="info">No Threads</div>;
    }
  }
}

export default class ThreadsWindowPane extends WebInspector.SidebarPane {
  constructor() {
    // WebInspector classes are not es6 classes, but babel forces a super call.
    super();
    // Actual super call.
    WebInspector.SidebarPane.call(this, 'Threads');

    // TODO: change.
    this.registerRequiredCSS('components/breakpointsList.css');

    ReactDOM.render(<ThreadsWindowComponent />, this.bodyElement);

    this.expand();
  }

  // This is implemented by various UI views, but is not declared anywhere as
  // an official interface. There's callers to various `reset` functions, so
  // it's probably safer to have this.
  reset() {}
}
