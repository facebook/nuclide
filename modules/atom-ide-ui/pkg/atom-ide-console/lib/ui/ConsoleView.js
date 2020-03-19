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

import type {Executor, Severity, Record, Source, SourceInfo} from '../types';
import type {RegExpFilterChange} from 'nuclide-commons-ui/RegExpFilter';

import {macrotask} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {Observable} from 'rxjs';
import FilterReminder from 'nuclide-commons-ui/FilterReminder';
import OutputTable from './OutputTable';
import ConsoleHeader from './ConsoleHeader';
import InputArea from './InputArea';
import PromptButton from './PromptButton';
import NewMessagesNotification from './NewMessagesNotification';
import invariant from 'assert';
import nullthrows from 'nullthrows';
import shallowEqual from 'shallowequal';
import recordsChanged from '../recordsChanged';
import StyleSheet from 'nuclide-commons-ui/StyleSheet';

type Props = {|
  records: Array<Record>,
  history: Array<string>,
  clearRecords: () => void,
  createPaste: ?() => Promise<void>,
  watchEditor: ?atom$AutocompleteWatchEditor,
  execute: (code: string) => void,
  currentExecutor: ?Executor,
  executors: Map<string, Executor>,
  invalidFilterInput: boolean,
  enableRegExpFilter: boolean,
  selectedSourceIds: Array<string>,
  selectExecutor: (executorId: string) => void,
  selectSources: (sourceIds: Array<string>) => void,
  sources: Array<Source>,
  updateFilter: (change: RegExpFilterChange) => void,
  getProvider: (id: string) => ?SourceInfo,
  filteredRecordCount: number,
  filterText: string,
  resetAllFilters: () => void,
  fontSize: number,
  selectedSeverities: Set<Severity>,
  toggleSeverity: (severity: Severity) => void,
|};

type State = {
  unseenMessages: boolean,
  scopeName: string,
};

// Maximum time (ms) for the console to try scrolling to the bottom.
const MAXIMUM_SCROLLING_TIME = 3000;
const DEFAULT_SCOPE_NAME = 'text.plain';

let count = 0;

export default class ConsoleView extends React.Component<Props, State> {
  _consoleScrollPaneEl: ?HTMLDivElement;
  _consoleHeaderComponent: ?ConsoleHeader;
  _disposables: UniversalDisposable;
  _executorScopeDisposables: UniversalDisposable;
  _isScrolledNearBottom: boolean;
  _id: number;
  _inputArea: ?InputArea;

  // Used when _scrollToBottom is called. The console optimizes message loading
  // so scrolling to the bottom once doesn't always scroll to the bottom since
  // more messages can be loaded after.
  _continuouslyScrollToBottom: boolean;
  _scrollingThrottle: ?rxjs$Subscription;

  _outputTable: ?OutputTable;

  constructor(props: Props) {
    super(props);
    this.state = {
      unseenMessages: false,
      scopeName: DEFAULT_SCOPE_NAME,
    };
    this._disposables = new UniversalDisposable();
    this._executorScopeDisposables = new UniversalDisposable();
    this._isScrolledNearBottom = true;
    this._continuouslyScrollToBottom = false;
    this._id = count++;
  }

  componentDidMount(): void {
    this._disposables.add(
      // Wait for `<OutputTable />` to render itself via react-virtualized before scrolling and
      // re-measuring; Otherwise, the scrolled location will be inaccurate, preventing the Console
      // from auto-scrolling.
      macrotask.subscribe(() => {
        this._startScrollToBottom();
      }),
      () => {
        if (this._scrollingThrottle != null) {
          this._scrollingThrottle.unsubscribe();
        }
      },
      atom.commands.add('atom-workspace', {
        // eslint-disable-next-line nuclide-internal/atom-apis
        'atom-ide-console:focus-console-prompt': () => {
          if (this._inputArea != null) {
            this._inputArea.focus();
          }
        },
      }),
      atom.commands.add('atom-workspace', {
        // eslint-disable-next-line nuclide-internal/atom-apis
        'atom-ide-console:scroll-to-bottom': () => {
          this._scrollToBottom();
        },
      }),
      atom.commands.add(
        nullthrows(this._consoleScrollPaneEl),
        'atom-ide:filter',
        () => this._focusFilter(),
      ),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
    this._executorScopeDisposables.dispose();
  }

  componentDidUpdate(prevProps: Props): void {
    // If records are added while we're scrolled to the bottom (or very very close, at least),
    // automatically scroll.
    if (
      this._isScrolledNearBottom &&
      recordsChanged(prevProps.records, this.props.records)
    ) {
      this._startScrollToBottom();
    }
  }

  _focusFilter(): void {
    if (this._consoleHeaderComponent != null) {
      this._consoleHeaderComponent.focusFilter();
    }
  }

  _renderPromptButton(): React.Element<any> {
    invariant(this.props.currentExecutor != null);
    const {currentExecutor} = this.props;
    const options = Array.from(this.props.executors.values()).map(executor => ({
      id: executor.id,
      label: executor.name,
    }));
    return (
      <PromptButton
        value={currentExecutor.id}
        onChange={this.props.selectExecutor}
        options={options}
        children={currentExecutor.name}
      />
    );
  }

  _isScrolledToBottom(
    offsetHeight: number,
    scrollHeight: number,
    scrollTop: number,
  ): boolean {
    return scrollHeight - (offsetHeight + scrollTop) < 5;
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props): void {
    // If the messages were cleared, hide the notification.
    if (nextProps.records.length === 0) {
      this._isScrolledNearBottom = true;
      this.setState({unseenMessages: false});
    } else if (
      // If we receive new messages after we've scrolled away from the bottom, show the "new
      // messages" notification.
      !this._isScrolledNearBottom &&
      recordsChanged(this.props.records, nextProps.records)
    ) {
      this.setState({unseenMessages: true});
    }

    this._executorScopeDisposables.dispose();
    this._executorScopeDisposables = new UniversalDisposable();
    for (const executor of nextProps.executors.values()) {
      if (executor != null && executor.onDidChangeScopeName != null) {
        this._executorScopeDisposables.add(
          executor.onDidChangeScopeName(() => {
            const scopeName = executor.scopeName();
            this.setState({
              scopeName,
            });
          }),
        );
      }
    }
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return (
      !shallowEqual(this.props, nextProps) ||
      !shallowEqual(this.state, nextState)
    );
  }

  _getExecutor = (id: string): ?Executor => {
    return this.props.executors.get(id);
  };

  _getProvider = (id: string): ?SourceInfo => {
    return this.props.getProvider(id);
  };

  render(): React.Node {
    return (
      <div className="console">
        <StyleSheet
          sourcePath="console-font-style"
          priority={-1}
          css={`
            #console-font-size-${this._id} {
              font-size: ${this.props.fontSize}px;
            }
          `}
        />
        <ConsoleHeader
          clear={this.props.clearRecords}
          createPaste={this.props.createPaste}
          invalidFilterInput={this.props.invalidFilterInput}
          enableRegExpFilter={this.props.enableRegExpFilter}
          filterText={this.props.filterText}
          ref={component => (this._consoleHeaderComponent = component)}
          selectedSourceIds={this.props.selectedSourceIds}
          sources={this.props.sources}
          onFilterChange={this.props.updateFilter}
          onSelectedSourcesChange={this.props.selectSources}
          selectedSeverities={this.props.selectedSeverities}
          toggleSeverity={this.props.toggleSeverity}
        />
        {/*
          We need an extra wrapper element here in order to have the new messages notification stick
          to the bottom of the scrollable area (and not scroll with it).

          console-font-size is defined in main.js and updated via a user setting
        */}
        <div className="console-body" id={'console-font-size-' + this._id}>
          <div
            className="console-scroll-pane-wrapper atom-ide-filterable"
            ref={el => (this._consoleScrollPaneEl = el)}>
            <FilterReminder
              noun="message"
              nounPlural="messages"
              filteredRecordCount={this.props.filteredRecordCount}
              onReset={this.props.resetAllFilters}
            />
            <OutputTable
              // $FlowFixMe(>=0.53.0) Flow suppress
              ref={this._handleOutputTable}
              records={this.props.records}
              showSourceLabels={this.props.selectedSourceIds.length > 1}
              fontSize={this.props.fontSize}
              getExecutor={this._getExecutor}
              getProvider={this._getProvider}
              onScroll={this._handleScroll}
              shouldScrollToBottom={this._shouldScrollToBottom}
            />
            <NewMessagesNotification
              visible={this.state.unseenMessages}
              onClick={this._startScrollToBottom}
            />
          </div>
          {this._renderPrompt()}
        </div>
      </div>
    );
  }

  _getMultiLineTip(): string {
    const {currentExecutor} = this.props;
    if (currentExecutor == null) {
      return '';
    }
    const keyCombo =
      process.platform === 'darwin'
        ? // Option + Enter on Mac
          '\u2325  + \u23CE'
        : // Shift + Enter on Windows and Linux.
          'Shift + Enter';

    return `Tip: ${keyCombo} to insert a newline`;
  }

  _renderPrompt(): ?React.Element<any> {
    const {currentExecutor} = this.props;
    if (currentExecutor == null) {
      return;
    }
    return (
      <div className="console-prompt">
        {this._renderPromptButton()}
        <InputArea
          ref={(component: ?InputArea) => (this._inputArea = component)}
          scopeName={this.state.scopeName}
          fontSize={this.props.fontSize}
          onSubmit={this._executePrompt}
          history={this.props.history}
          watchEditor={this.props.watchEditor}
          placeholderText={this._getMultiLineTip()}
        />
      </div>
    );
  }

  _executePrompt = (code: string): void => {
    this.props.execute(code);
    // Makes the console to scroll to the bottom.
    this._isScrolledNearBottom = true;
  };

  _handleScroll = (
    offsetHeight: number,
    scrollHeight: number,
    scrollTop: number,
  ): void => {
    this._handleScrollEnd(offsetHeight, scrollHeight, scrollTop);
  };

  _handleScrollEnd(
    offsetHeight: number,
    scrollHeight: number,
    scrollTop: number,
  ): void {
    const isScrolledToBottom = this._isScrolledToBottom(
      offsetHeight,
      scrollHeight,
      scrollTop,
    );

    this._isScrolledNearBottom = isScrolledToBottom;
    this._stopScrollToBottom();
    this.setState({
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
      unseenMessages: this.state.unseenMessages && !this._isScrolledNearBottom,
    });
  }

  _handleOutputTable = (ref: OutputTable): void => {
    this._outputTable = ref;
  };

  _scrollToBottom = (): void => {
    if (!this._outputTable) {
      return;
    }

    this._outputTable.scrollToBottom();

    this.setState({unseenMessages: false});
  };

  _startScrollToBottom = (): void => {
    if (!this._continuouslyScrollToBottom) {
      this._continuouslyScrollToBottom = true;

      this._scrollingThrottle = Observable.timer(
        MAXIMUM_SCROLLING_TIME,
      ).subscribe(() => {
        this._stopScrollToBottom();
      });
    }

    this._scrollToBottom();
  };

  _stopScrollToBottom = (): void => {
    this._continuouslyScrollToBottom = false;
    if (this._scrollingThrottle != null) {
      this._scrollingThrottle.unsubscribe();
    }
  };

  _shouldScrollToBottom = (): boolean => {
    return this._isScrolledNearBottom || this._continuouslyScrollToBottom;
  };
}
