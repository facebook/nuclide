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

import type {IProcess, IDebugService, IThread} from '../types';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {TreeItem, NestedTreeItem} from 'nuclide-commons-ui/Tree';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {fastDebounce} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {Observable} from 'rxjs';
import ThreadTreeNode from './ThreadTreeNode';
import {DebuggerMode} from '../constants';
import {
  LoadingSpinnerSizes,
  LoadingSpinner,
} from 'nuclide-commons-ui/LoadingSpinner';
import {Icon} from 'nuclide-commons-ui/Icon';

type Props = {
  process: IProcess,
  service: IDebugService,
  title: string,
  filter: ?string,
  filterRegEx: ?RegExp,
  showPausedThreadsOnly: boolean,
};

type State = {
  isCollapsed: boolean,
  threads: Array<IThread>,
  isFocused: boolean,
  pendingStart: boolean,
};

export default class ProcessTreeNode extends React.Component<Props, State> {
  _disposables: UniversalDisposable;
  _filter: ?AtomInput;

  constructor(props: Props) {
    super(props);
    this.state = this._getState();
    this._disposables = new UniversalDisposable();
  }

  componentDidMount(): void {
    const {service} = this.props;
    const model = service.getModel();
    const {viewModel} = service;
    this._disposables.add(
      Observable.merge(
        observableFromSubscribeFunction(
          viewModel.onDidChangeDebuggerFocus.bind(viewModel),
        ),
      )
        .let(fastDebounce(15))
        .subscribe(this._handleFocusChanged),
      observableFromSubscribeFunction(model.onDidChangeCallStack.bind(model))
        .let(fastDebounce(15))
        .subscribe(this._handleCallStackChanged),
      observableFromSubscribeFunction(
        service.onDidChangeProcessMode.bind(service),
      ).subscribe(() =>
        this.setState(prevState => this._getState(prevState.isCollapsed)),
      ),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  _handleFocusChanged = (): void => {
    this.setState(prevState =>
      this._getState(!(this._computeIsFocused() || !prevState.isCollapsed)),
    );
  };

  _handleCallStackChanged = (): void => {
    const {process} = this.props;
    this.setState({
      threads: process.getAllThreads(),
    });
  };

  _computeIsFocused(): boolean {
    const {service, process} = this.props;
    const focusedProcess = service.viewModel.focusedProcess;
    return process === focusedProcess;
  }

  _getState(shouldBeCollapsed: ?boolean) {
    const {process} = this.props;
    const isFocused = this._computeIsFocused();
    const pendingStart = process.debuggerMode === DebuggerMode.STARTING;
    const isCollapsed =
      shouldBeCollapsed != null ? shouldBeCollapsed : !isFocused;
    return {
      isFocused,
      threads: process.getAllThreads(),
      isCollapsed,
      pendingStart,
    };
  }

  handleSelect = () => {
    this.setState(prevState => this._getState(!prevState.isCollapsed));
  };

  _threadTitle = (thread: IThread) => {
    const stopReason =
      thread.stoppedDetails == null
        ? ''
        : thread.stoppedDetails.description != null
          ? ': ' + thread.stoppedDetails.description
          : thread.stoppedDetails.reason != null
            ? ': ' + thread.stoppedDetails.reason
            : '';
    return (
      thread.name + (thread.stopped ? ` (Paused${stopReason})` : ' (Running)')
    );
  };

  // Returns true if thread should be kept.
  filterThread(thread: IThread): boolean {
    const {filter, filterRegEx} = this.props;
    if (this.props.showPausedThreadsOnly && !thread.stopped) {
      return false;
    }

    if (filter == null) {
      return true;
    } else if (filterRegEx == null) {
      // User entered an invalid regular expression.
      // Simply check if any thread contains the user's input.
      return this.props.title.toUpperCase().includes(filter.toUpperCase());
    } else {
      return (
        this._threadTitle(thread).match(filterRegEx) != null ||
        thread
          .getCachedCallStack()
          .some(
            frame =>
              frame.name.match(filterRegEx) ||
              (frame.source.name != null &&
                frame.source.name.match(filterRegEx)),
          )
      );
    }
  }

  render() {
    const {service, title, process} = this.props;
    const {threads, isFocused, isCollapsed} = this.state;

    const readOnly =
      service.viewModel.focusedProcess != null &&
      service.viewModel.focusedProcess.configuration.isReadOnly;
    const handleTitleClick = event => {
      if (!this._computeIsFocused()) {
        service.viewModel.setFocusedProcess(process, true);
        event.stopPropagation();
      }
    };

    const firstExtension =
      this.props.process.configuration.servicedFileExtensions == null
        ? ''
        : String(this.props.process.configuration.servicedFileExtensions[0]);
    const fileIcon = this.state.pendingStart ? (
      <div className="inline-block" title="Starting debugger...">
        <LoadingSpinner
          size={LoadingSpinnerSizes.EXTRA_SMALL}
          className="inline-block"
        />
      </div>
    ) : (
      <span
        className={`debugger-tree-file-icon ${firstExtension}-icon`}
        onClick={handleTitleClick}
        title={firstExtension.toUpperCase()}
      />
    );

    const formattedTitle = (
      <span>
        {fileIcon}
        <span
          onClick={handleTitleClick}
          className={
            isFocused
              ? 'debugger-tree-process debugger-tree-process-thread-selected'
              : 'debugger-tree-process'
          }
          title={title}>
          {title}
          {readOnly ? ' (READ ONLY)' : null}
        </span>
      </span>
    );

    const filteredThreads = threads.filter(t => this.filterThread(t));
    const focusedThread = service.viewModel.focusedThread;
    const selectedThreadFiltered =
      threads.some(t => t === focusedThread) &&
      !filteredThreads.some(t => t === focusedThread);
    const focusedThreadHiddenWarning = (
      <span className="debugger-thread-no-match-text">
        <Icon icon="nuclicon-warning" />
        The focused thread is hidden by your thread filter!
      </span>
    );
    return threads.length === 0 ? (
      <TreeItem>{formattedTitle}</TreeItem>
    ) : (
      <NestedTreeItem
        title={formattedTitle}
        collapsed={isCollapsed}
        onSelect={this.handleSelect}>
        {filteredThreads.length === 0 && threads.length > 0 ? (
          selectedThreadFiltered ? (
            focusedThreadHiddenWarning
          ) : (
            <span className="debugger-thread-no-match-text">
              No threads match the current filter.
            </span>
          )
        ) : (
          filteredThreads
            .map((thread, threadIndex) => (
              <ThreadTreeNode
                key={threadIndex}
                thread={thread}
                service={service}
                threadTitle={this._threadTitle(thread)}
              />
            ))
            .concat(selectedThreadFiltered ? focusedThreadHiddenWarning : null)
        )}
      </NestedTreeItem>
    );
  }
}
