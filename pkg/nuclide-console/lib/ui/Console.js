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

import type {
  DisplayableRecord,
  Executor,
  OutputProvider,
  RecordHeightChangeHandler,
  Source,
} from '../types';
import type {RegExpFilterChange} from 'nuclide-commons-ui/RegExpFilter';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import debounce from 'nuclide-commons/debounce';
import React from 'react';
import FilteredMessagesReminder from './FilteredMessagesReminder';
import OutputTable from './OutputTable';
import ConsoleHeader from './ConsoleHeader';
import InputArea from './InputArea';
import PromptButton from './PromptButton';
import NewMessagesNotification from './NewMessagesNotification';
import invariant from 'assert';
import shallowEqual from 'shallowequal';
import recordsChanged from '../recordsChanged';

type Props = {
  displayableRecords: Array<DisplayableRecord>,
  history: Array<string>,
  clearRecords: () => void,
  createPaste: ?() => Promise<void>,
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
  getProvider: (id: string) => ?OutputProvider,
  onDisplayableRecordHeightChange: RecordHeightChangeHandler,
  filteredRecordCount: number,
  filterText: string,
  resetAllFilters: () => void,
};

type State = {
  unseenMessages: boolean,
};

export default class Console extends React.Component {
  props: Props;
  state: State;
  _disposables: UniversalDisposable;
  _isScrolledNearBottom: boolean;
  _outputTable: ?OutputTable;

  constructor(props: Props) {
    super(props);
    this.state = {
      unseenMessages: false,
    };
    this._disposables = new UniversalDisposable();
    this._isScrolledNearBottom = true;
    (this: any)._handleScrollEnd = debounce(this._handleScrollEnd, 100);
  }

  componentDidMount(): void {
    // Wait for `<OutputTable />` to render itself via react-virtualized before scrolling and
    // re-measuring; Otherwise, the scrolled location will be inaccurate, preventing the Console
    // from auto-scrolling.
    const immediate = setImmediate(() => {
      this._scrollToBottom();
    });
    this._disposables.add(() => {
      clearImmediate(immediate);
    });
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate(prevProps: Props): void {
    // If records are added while we're scrolled to the bottom (or very very close, at least),
    // automatically scroll.
    if (
      this._isScrolledNearBottom &&
      recordsChanged(
        prevProps.displayableRecords,
        this.props.displayableRecords,
      )
    ) {
      this._scrollToBottom();
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

  componentWillReceiveProps(nextProps: Props): void {
    // If the messages were cleared, hide the notification.
    if (nextProps.displayableRecords.length === 0) {
      this._isScrolledNearBottom = true;
      this.setState({unseenMessages: false});
    } else if (
      // If we receive new messages after we've scrolled away from the bottom, show the "new
      // messages" notification.
      !this._isScrolledNearBottom &&
      recordsChanged(
        this.props.displayableRecords,
        nextProps.displayableRecords,
      )
    ) {
      this.setState({unseenMessages: true});
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

  _getProvider = (id: string): ?OutputProvider => {
    return this.props.getProvider(id);
  };

  render(): ?React.Element<any> {
    return (
      <div className="nuclide-console">
        <ConsoleHeader
          clear={this.props.clearRecords}
          createPaste={this.props.createPaste}
          invalidFilterInput={this.props.invalidFilterInput}
          enableRegExpFilter={this.props.enableRegExpFilter}
          filterText={this.props.filterText}
          selectedSourceIds={this.props.selectedSourceIds}
          sources={this.props.sources}
          onFilterChange={this.props.updateFilter}
          onSelectedSourcesChange={this.props.selectSources}
        />
        {/*
          We need an extra wrapper element here in order to have the new messages notification stick
          to the bottom of the scrollable area (and not scroll with it).
        */}
        <div className="nuclide-console-body">
          <div className="nuclide-console-scroll-pane-wrapper">
            <FilteredMessagesReminder
              filteredRecordCount={this.props.filteredRecordCount}
              onReset={this.props.resetAllFilters}
            />
            <OutputTable
              ref={this._handleOutputTable}
              displayableRecords={this.props.displayableRecords}
              showSourceLabels={this.props.selectedSourceIds.length > 1}
              getExecutor={this._getExecutor}
              getProvider={this._getProvider}
              onScroll={this._handleScroll}
              onDisplayableRecordHeightChange={
                this.props.onDisplayableRecordHeightChange
              }
            />
            <NewMessagesNotification
              visible={this.state.unseenMessages}
              onClick={this._scrollToBottom}
            />
          </div>
          {this._renderPrompt()}
        </div>
      </div>
    );
  }

  _renderPrompt(): ?React.Element<any> {
    const {currentExecutor} = this.props;
    if (currentExecutor == null) {
      return;
    }
    return (
      <div className="nuclide-console-prompt">
        {this._renderPromptButton()}
        <InputArea
          scopeName={currentExecutor.scopeName}
          onSubmit={this.props.execute}
          history={this.props.history}
        />
      </div>
    );
  }

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
    this._isScrolledNearBottom = this._isScrolledToBottom(
      offsetHeight,
      scrollHeight,
      scrollTop,
    );
    this.setState({
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
}
